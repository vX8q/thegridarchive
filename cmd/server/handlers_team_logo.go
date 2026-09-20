package main

import (
	"bytes"
	"encoding/json"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	_ "image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

var (
	teamLogosOnce sync.Once
	teamLogosMap  map[string]string
	teamLogosErr  error
	teamLogosMu   sync.Mutex
	reSlugParts   = regexp.MustCompile(`[^a-z0-9]+`)
)

func loadTeamLogos(dataDir string) (map[string]string, error) {
	teamLogosOnce.Do(func() {
		teamLogosMap = map[string]string{}
		path := filepath.Join(dataDir, "team_logos.json")
		b, err := os.ReadFile(path) //nolint:gosec
		if err != nil {
			if os.IsNotExist(err) {
				return
			}
			teamLogosErr = err
			return
		}
		var raw map[string]string
		if err := json.Unmarshal(b, &raw); err != nil {
			teamLogosErr = err
			return
		}
		for k, v := range raw {
			key := teamSlug(k)
			if key == "" || strings.TrimSpace(v) == "" {
				continue
			}
			teamLogosMap[key] = strings.TrimSpace(v)
		}
	})
	return teamLogosMap, teamLogosErr
}

func teamSlug(s string) string {
	v := strings.ToLower(strings.TrimSpace(s))
	v = reSlugParts.ReplaceAllString(v, "-")
	v = strings.Trim(v, "-")
	return v
}

func writeFallbackTeamLogoSVG(w http.ResponseWriter, _ string) {
	// Plain grey plate — no colored initials avatar.
	svg := `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="14" fill="#3a3a3a"/></svg>`
	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write([]byte(svg))
}

func handleTeamLogo(w http.ResponseWriter, r *http.Request, dataDir string) {
	slug := strings.TrimPrefix(r.URL.Path, "/api/team-logo/")
	slug = teamSlug(strings.TrimSpace(strings.TrimRight(slug, "/")))
	if slug == "" {
		writeError(w, http.StatusBadRequest, "missing team slug")
		return
	}

	logos, _ := loadTeamLogos(dataDir)
	logoURL := strings.TrimSpace(logos[slug])
	if logoURL == "" {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}

	cacheDir := filepath.Join(dataDir, "cache", "team_logos")
	cachePath := filepath.Join(cacheDir, slug+".png")
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(b)
		return
	}

	teamLogosMu.Lock()
	defer teamLogosMu.Unlock()
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(b)
		return
	}

	client := &http.Client{Timeout: 12 * time.Second}
	safeURL, ok := allowedRemoteImageURL(logoURL)
	if !ok {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}
	raw, status, err := fetchTeamLogoBytes(client, safeURL)
	if err != nil || status < 200 || status >= 300 || looksLikeHTML(raw) {
		// One retry — Commons often 429s under burst; second try usually succeeds.
		time.Sleep(400 * time.Millisecond)
		raw, status, err = fetchTeamLogoBytes(client, safeURL)
	}
	if err != nil || status < 200 || status >= 300 || looksLikeHTML(raw) {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}

	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}

	const outW = 96
	const outH = 96
	dst := image.NewRGBA(image.Rect(0, 0, outW, outH))
	b := src.Bounds()
	sw := b.Dx()
	sh := b.Dy()
	if sw <= 0 || sh <= 0 {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}
	scaleX := float64(outW) / float64(sw)
	scaleY := float64(outH) / float64(sh)
	scale := scaleX
	if scaleY < scale {
		scale = scaleY
	}
	dw := int(float64(sw) * scale)
	dh := int(float64(sh) * scale)
	if dw < 1 {
		dw = 1
	}
	if dh < 1 {
		dh = 1
	}
	dx := (outW - dw) / 2
	dy := (outH - dh) / 2
	draw.CatmullRom.Scale(dst, image.Rect(dx, dy, dx+dw, dy+dh), src, b, draw.Over, nil)

	var out bytes.Buffer
	enc := png.Encoder{CompressionLevel: png.BestSpeed}
	if err := enc.Encode(&out, dst); err != nil {
		writeFallbackTeamLogoSVG(w, slug)
		return
	}
	if err := os.MkdirAll(cacheDir, 0o750); err == nil {
		_ = os.WriteFile(cachePath, out.Bytes(), 0o600)
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(out.Bytes())
}

func fetchTeamLogoBytes(client *http.Client, url string) ([]byte, int, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, remoteImageMaxBytes))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return raw, resp.StatusCode, nil
}

func looksLikeHTML(raw []byte) bool {
	if len(raw) < 15 {
		return false
	}
	n := len(raw)
	if n > 64 {
		n = 64
	}
	head := strings.ToLower(string(raw[:n]))
	return strings.Contains(head, "<!doctype html") || strings.Contains(head, "<html")
}
