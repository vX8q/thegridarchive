package main

import (
	"encoding/xml"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

const sitemapXMLNS = "http://www.sitemaps.org/schemas/sitemap/0.9"

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

type sitemapURL struct {
	Loc string `xml:"loc"`
}

var sitemapPathsCache struct {
	mu    sync.Mutex
	mtime time.Time
	paths []string
}

func requestPublicOrigin(r *http.Request) string {
	host := strings.TrimSpace(r.Host)
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	// Behind a reverse proxy, TLS terminates upstream — honor X-Forwarded-Proto
	// only when TGA_TRUSTED_PROXY is enabled (same gate as clientIP).
	if clientIPTrustedProxy {
		if proto := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto")); proto != "" {
			proto = strings.ToLower(strings.TrimSpace(strings.SplitN(proto, ",", 2)[0]))
			if proto == "https" || proto == "http" {
				scheme = proto
			}
		}
	}
	if host == "" {
		host = "localhost"
	}
	return scheme + "://" + host
}

func joinOriginPath(origin, path string) string {
	origin = strings.TrimRight(origin, "/")
	if path == "" || path == "/" {
		return origin + "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return origin + path
}

func seriesPublicPath(c config.Championship) string {
	slug := strings.ToLower(strings.ReplaceAll(c.ID, "_", "-"))
	if strings.EqualFold(c.ID, "F1") {
		return "/season/f1-" + config.CurrentSeason
	}
	return "/series/" + slug
}

func eventPublicPath(eventID string) string {
	slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(eventID), "_", "-"))
	if slug == "" {
		return ""
	}
	return "/event/" + slug
}

func sitemapSourceMtime(dataDir string) time.Time {
	latest := schedulefile.AggregatedScheduleMaxMtime(dataDir)
	if fi, err := os.Stat(filepath.Join(dataDir, "driver_profiles.json")); err == nil {
		if fi.ModTime().After(latest) {
			latest = fi.ModTime()
		}
	}
	if fi, err := os.Stat(filepath.Join(dataDir, "team_profiles.json")); err == nil {
		if fi.ModTime().After(latest) {
			latest = fi.ModTime()
		}
	}
	return latest
}

func buildSitemapPaths(dataDir string) []string {
	paths := []string{"/"}
	seen := map[string]struct{}{"/": {}}
	add := func(p string) {
		if p == "" {
			return
		}
		if _, ok := seen[p]; ok {
			return
		}
		seen[p] = struct{}{}
		paths = append(paths, p)
	}

	for _, c := range config.Championships {
		add(seriesPublicPath(c))
	}

	season := config.CurrentSeason
	for _, c := range config.Championships {
		events, err := schedulefile.LoadEvents(dataDir, c.ID)
		if err != nil || len(events) == 0 {
			continue
		}
		for _, e := range filterEventsBySeason(events, season) {
			add(eventPublicPath(e.ID))
		}
	}

	profiles, err := loadDriverProfiles(dataDir)
	if err == nil {
		slugs := make([]string, 0, len(profiles))
		for slug := range profiles {
			slug = strings.TrimSpace(slug)
			if slug != "" {
				slugs = append(slugs, slug)
			}
		}
		sort.Strings(slugs)
		for _, slug := range slugs {
			add("/driver/" + slug)
		}
	}

	teamProfiles, teamErr := loadTeamProfiles(dataDir)
	if teamErr == nil {
		slugs := make([]string, 0, len(teamProfiles))
		for slug := range teamProfiles {
			slug = strings.TrimSpace(slug)
			if slug != "" {
				slugs = append(slugs, slug)
			}
		}
		sort.Strings(slugs)
		for _, slug := range slugs {
			add("/team/" + slug)
		}
	}

	return paths
}

func sitemapPaths(dataDir string) []string {
	mtime := sitemapSourceMtime(dataDir)
	sitemapPathsCache.mu.Lock()
	defer sitemapPathsCache.mu.Unlock()
	if sitemapPathsCache.paths != nil && sitemapPathsCache.mtime.Equal(mtime) {
		return sitemapPathsCache.paths
	}
	paths := buildSitemapPaths(dataDir)
	sitemapPathsCache.mtime = mtime
	sitemapPathsCache.paths = paths
	return paths
}

func handleSitemap(w http.ResponseWriter, r *http.Request, dataDir string) {
	origin := requestPublicOrigin(r)
	paths := sitemapPaths(dataDir)
	urls := make([]sitemapURL, 0, len(paths))
	for _, p := range paths {
		urls = append(urls, sitemapURL{Loc: joinOriginPath(origin, p)})
	}
	body, err := xml.MarshalIndent(sitemapURLSet{
		Xmlns: sitemapXMLNS,
		URLs:  urls,
	}, "", "  ")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to encode sitemap")
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(xml.Header))
	_, _ = w.Write(body)
	_, _ = w.Write([]byte("\n"))
}

func handleRobots(w http.ResponseWriter, r *http.Request) {
	origin := requestPublicOrigin(r)
	body := "User-agent: *\nAllow: /\n\nSitemap: " + joinOriginPath(origin, "/sitemap.xml") + "\n"
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(body))
}
