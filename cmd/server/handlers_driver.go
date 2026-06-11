package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	_ "image/gif"
	"image/jpeg"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/driverutil"
	"github.com/vX8q/tga/internal/schedulefile"
	"github.com/vX8q/tga/internal/store"
	"github.com/vX8q/tga/models"
	"golang.org/x/image/draw"
)

type driverProfile struct {
	FullName    string `json:"full_name"`
	BirthDate   string `json:"birth_date"` // YYYY-MM-DD
	BirthPlace  string `json:"birth_place"`
	DeathDate   string `json:"death_date"` // YYYY-MM-DD
	DeathPlace  string `json:"death_place"`
	Citizenship string `json:"citizenship"`
	PhotoURL    string `json:"photo_url"`
}

var (
	driverProfilesMu           sync.RWMutex
	driverProfiles             map[string]driverProfile
	driverProfilesErr          error
	driverProfilesMTime        time.Time
	driverProfileRedirectsMu   sync.RWMutex
	driverProfileRedirects     map[string]string
	driverProfileRedirectsErr  error
	driverProfileRedirectsMTime time.Time
	driverThumbsMu              sync.Mutex
)

func loadDriverProfiles(dataDir string) (map[string]driverProfile, error) {
	path := filepath.Join(dataDir, "driver_profiles.json")
	fi, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			driverProfilesMu.Lock()
			driverProfiles = map[string]driverProfile{}
			driverProfilesErr = nil
			driverProfilesMTime = time.Time{}
			driverProfilesMu.Unlock()
			return map[string]driverProfile{}, nil
		}
		driverProfilesMu.RLock()
		defer driverProfilesMu.RUnlock()
		return driverProfiles, statErr
	}

	modTime := fi.ModTime()
	driverProfilesMu.RLock()
	cached := driverProfiles
	cachedErr := driverProfilesErr
	cachedMTime := driverProfilesMTime
	driverProfilesMu.RUnlock()
	if cached != nil && cachedErr == nil && modTime.Equal(cachedMTime) {
		return cached, nil
	}

	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		driverProfilesMu.Lock()
		driverProfilesErr = err
		driverProfilesMu.Unlock()
		return driverProfiles, err
	}
	var m map[string]driverProfile
	if err := json.Unmarshal(b, &m); err != nil {
		driverProfilesMu.Lock()
		driverProfilesErr = err
		driverProfilesMu.Unlock()
		return driverProfiles, err
	}
	if m == nil {
		m = map[string]driverProfile{}
	}
	driverProfilesMu.Lock()
	driverProfiles = m
	driverProfilesErr = nil
	driverProfilesMTime = modTime
	driverProfilesMu.Unlock()
	return m, nil
}

func loadDriverProfileRedirects(dataDir string) (map[string]string, error) {
	path := filepath.Join(dataDir, "driver_profile_redirects.json")
	fi, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			driverProfileRedirectsMu.Lock()
			driverProfileRedirects = map[string]string{}
			driverProfileRedirectsErr = nil
			driverProfileRedirectsMTime = time.Time{}
			driverProfileRedirectsMu.Unlock()
			return map[string]string{}, nil
		}
		driverProfileRedirectsMu.RLock()
		defer driverProfileRedirectsMu.RUnlock()
		return driverProfileRedirects, statErr
	}

	modTime := fi.ModTime()
	driverProfileRedirectsMu.RLock()
	cached := driverProfileRedirects
	cachedErr := driverProfileRedirectsErr
	cachedMTime := driverProfileRedirectsMTime
	driverProfileRedirectsMu.RUnlock()
	if cached != nil && cachedErr == nil && modTime.Equal(cachedMTime) {
		return cached, nil
	}

	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		driverProfileRedirectsMu.Lock()
		driverProfileRedirectsErr = err
		driverProfileRedirectsMu.Unlock()
		return driverProfileRedirects, err
	}
	var m map[string]string
	if err := json.Unmarshal(b, &m); err != nil {
		driverProfileRedirectsMu.Lock()
		driverProfileRedirectsErr = err
		driverProfileRedirectsMu.Unlock()
		return driverProfileRedirects, err
	}
	if m == nil {
		m = map[string]string{}
	}
	driverProfileRedirectsMu.Lock()
	driverProfileRedirects = m
	driverProfileRedirectsErr = nil
	driverProfileRedirectsMTime = modTime
	driverProfileRedirectsMu.Unlock()
	return m, nil
}

func resolveDriverProfileSlug(slugKey string, profiles map[string]driverProfile, redirects map[string]string) string {
	slugKey = strings.TrimSpace(strings.ToLower(slugKey))
	if slugKey == "" {
		return ""
	}
	if redirects != nil {
		if target := strings.TrimSpace(strings.ToLower(redirects[slugKey])); target != "" {
			slugKey = target
		}
	}
	if profiles != nil {
		if _, ok := profiles[slugKey]; ok {
			return slugKey
		}
	}
	return slugKey
}

func titleFromDriverSlug(slug string) string {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return ""
	}
	var out []string
	for _, w := range strings.Split(slug, "-") {
		w = strings.TrimSpace(w)
		if w == "" {
			continue
		}
		switch strings.ToLower(w) {
		case "jr":
			out = append(out, "Jr.")
		case "sr":
			out = append(out, "Sr.")
		case "ii", "iii", "iv":
			out = append(out, strings.ToUpper(w))
		default:
			out = append(out, strings.ToUpper(w[:1])+strings.ToLower(w[1:]))
		}
	}
	return strings.Join(out, " ")
}

// profileDisplayName is the name used in entry lists / results (not the legal full name).
func profileDisplayName(profileSlug string, p driverProfile) string {
	legal := strings.TrimSpace(p.FullName)
	if legal == "" {
		return titleFromDriverSlug(profileSlug)
	}
	parts := strings.Fields(legal)
	if len(parts) <= 2 {
		if slugUsesDifferentFirstName(profileSlug, legal) {
			slugParts := strings.Fields(titleFromDriverSlug(profileSlug))
			if len(slugParts) >= 1 && len(parts) >= 2 {
				return strings.TrimSpace(slugParts[0] + " " + parts[len(parts)-1])
			}
		}
		return driverutil.FoldDiacritics(legal)
	}
	// Legal names with middle/paternal surnames: use event slug (e.g. fernando-alonso, not Fernando Díaz).
	if strings.Count(profileSlug, "-") >= 1 {
		if titled := titleFromDriverSlug(profileSlug); titled != "" {
			return driverutil.FoldDiacritics(titled)
		}
	}
	return driverutil.FoldDiacritics(parts[0] + " " + parts[len(parts)-1])
}

// slugUsesDifferentFirstName is true when the event slug's given name differs from legal
// full_name (e.g. slug nico-hulkenberg vs legal Nicolas Hülkenberg).
func slugUsesDifferentFirstName(profileSlug, legalFullName string) bool {
	legalParts := strings.Fields(strings.TrimSpace(legalFullName))
	if len(legalParts) == 0 {
		return false
	}
	slugParts := strings.Fields(titleFromDriverSlug(profileSlug))
	if len(slugParts) == 0 {
		return false
	}
	return !strings.EqualFold(slugParts[0], legalParts[0])
}

// profileLegalName returns the legal full name when it should be shown separately from display name.
func profileLegalName(profileSlug string, p driverProfile) string {
	legal := strings.TrimSpace(p.FullName)
	if legal == "" {
		return ""
	}
	parts := strings.Fields(legal)
	if len(parts) > 2 {
		return legal
	}
	if slugUsesDifferentFirstName(profileSlug, legal) {
		return legal
	}
	return ""
}

func attachProfileMetadata(resp map[string]interface{}, profileSlug string, p driverProfile, displayName string) {
	if resp == nil {
		return
	}
	legal := profileLegalName(profileSlug, p)
	if legal != "" {
		resp["legal_full_name"] = legal
	}
	if strings.TrimSpace(displayName) != "" {
		resp["name"] = strings.TrimSpace(displayName)
	}
	if strings.TrimSpace(p.Citizenship) != "" {
		resp["citizenship"] = strings.TrimSpace(p.Citizenship)
		resp["nationality"] = strings.TrimSpace(p.Citizenship)
	}
	if strings.TrimSpace(p.BirthPlace) != "" {
		resp["birth_place"] = strings.TrimSpace(p.BirthPlace)
	}
	if strings.TrimSpace(p.BirthDate) != "" {
		resp["birth_date"] = strings.TrimSpace(p.BirthDate)
	}
	if strings.TrimSpace(p.DeathDate) != "" {
		resp["death_date"] = strings.TrimSpace(p.DeathDate)
	}
	if strings.TrimSpace(p.DeathPlace) != "" {
		resp["death_place"] = strings.TrimSpace(p.DeathPlace)
	}
	if strings.TrimSpace(p.PhotoURL) != "" {
		resp["photo_url"] = strings.TrimSpace(p.PhotoURL)
	}
	_ = profileSlug
}

func handleDriversList(w http.ResponseWriter, r *http.Request, dataDir string, st store.Store) {
	type driverItem struct {
		Name        string `json:"name"`
		Slug        string `json:"slug"`
		SearchExtra string `json:"search_extra,omitempty"`
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")

	dedupe := map[string]driverItem{}
	normalizeSearchDriverName := func(name string) string {
		n := strings.TrimSpace(name)
		if n == "" {
			return ""
		}
		// "(i)" is eligibility metadata, not part of a person's identity.
		lower := strings.ToLower(n)
		if strings.HasSuffix(lower, "(i)") {
			n = strings.TrimSpace(n[:len(n)-3])
		}
		n = driverutil.FoldDiacritics(n)
		n = strings.Join(strings.Fields(n), " ")
		return n
	}
	canonicalDriverName := func(slug, name string) string {
		switch strings.ToLower(strings.TrimSpace(slug)) {
		case "a-j-allmendinger":
			return "A. J. Allmendinger"
		case "b-j-mcleod":
			return "B. J. McLeod"
		case "j-j-yeley":
			return "J. J. Yeley"
		default:
			return normalizeSearchDriverName(name)
		}
	}
	add := func(name string) {
		n := normalizeSearchDriverName(name)
		if n == "" {
			return
		}
		if shouldSkipSearchDriverName(n) {
			return
		}
		s := driverutil.NormalizeSlug(driverutil.Slug(n))
		if s == "" {
			return
		}
		n = canonicalDriverName(s, n)
		if old, ok := dedupe[s]; ok {
			if len(strings.TrimSpace(old.Name)) >= len(n) {
				return
			}
		}
		dedupe[s] = driverItem{Name: n, Slug: s}
	}
	addWithSlug := func(name, slug, searchExtra string) {
		n := normalizeSearchDriverName(name)
		s := driverutil.NormalizeSlug(strings.TrimSpace(slug))
		if s == "" {
			add(n)
			return
		}
		if n == "" {
			n = strings.ReplaceAll(s, "-", " ")
		}
		n = canonicalDriverName(s, n)
		if shouldSkipSearchDriverName(n) {
			return
		}
		if old, ok := dedupe[s]; ok {
			if len(strings.TrimSpace(old.Name)) >= len(n) && strings.TrimSpace(old.SearchExtra) != "" {
				return
			}
		}
		dedupe[s] = driverItem{Name: n, Slug: s, SearchExtra: strings.TrimSpace(searchExtra)}
	}

	if st != nil {
		drivers, err := st.ListDrivers(r.Context())
		if err != nil {
			slog.Warn("list drivers failed", "err", err, "trace_id", TraceID(r.Context()))
		} else {
			for _, d := range drivers {
				add(d.Name)
			}
		}
	}
	profiles, _ := loadDriverProfiles(dataDir)
	redirects, _ := loadDriverProfileRedirects(dataDir)
	redirectSource := map[string]struct{}{}
	for from := range redirects {
		redirectSource[from] = struct{}{}
	}
	for slug, p := range profiles {
		if _, skip := redirectSource[slug]; skip {
			continue
		}
		display := profileDisplayName(slug, p)
		if display == "" {
			continue
		}
		addWithSlug(display, slug, profileLegalName(slug, p))
	}

	out := make([]driverItem, 0, len(dedupe))
	for _, v := range dedupe {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})
	if err := jsonMarshalTo(w, out); err != nil {
		slog.Warn("jsonMarshalTo failed", "endpoint", "/api/drivers", "err", err)
	}
}

func shouldSkipSearchDriverName(name string) bool {
	n := strings.TrimSpace(name)
	if n == "" {
		return true
	}
	// Composite crews should not appear as "driver" entities.
	if strings.Contains(n, "/") || strings.Contains(n, ";") {
		return true
	}
	parts := strings.Fields(n)
	// Single-token surnames/aliases (e.g. "Verstappen") add noise.
	if len(parts) < 2 {
		return true
	}
	// Initial-based aliases (e.g. "M. Verstappen") are noisy duplicates.
	if len(parts) == 2 && strings.HasSuffix(parts[0], ".") {
		return true
	}
	return false
}

// driverFilledScore returns the number of filled fields (nationality, birth_date, birth_place).
func driverFilledScore(d *models.Driver) int {
	n := 0
	if d.Nationality != "" {
		n++
	}
	if !d.BirthDate.IsZero() {
		n++
	}
	if d.BirthPlace != "" {
		n++
	}
	return n
}

func handleDriverBySlug(w http.ResponseWriter, r *http.Request, dataDir string, st store.Store) {
	slug := strings.TrimPrefix(r.URL.Path, "/api/driver/")
	slug = strings.TrimRight(slug, "/")
	slug = strings.TrimSpace(slug)
	if slug == "" {
		writeError(w, http.StatusBadRequest, "missing driver slug")
		return
	}

	slug = driverutil.NormalizeSlug(slug)
	profiles, _ := loadDriverProfiles(dataDir)
	redirects, _ := loadDriverProfileRedirects(dataDir)
	slugKey := driverutil.Slug(slug)
	slugKey = resolveDriverProfileSlug(slugKey, profiles, redirects)
	canonicalSlug := slugKey
	profile, hasProfile := driverProfile{}, false
	if profiles != nil {
		profile, hasProfile = profiles[slugKey]
	}

	season := config.CurrentSeason
	seasonResults, errSeason := schedulefile.BuildDriverSeasonResultsFromEvents(
		dataDir,
		driverutil.Slug(slug),
		season,
	)
	if errSeason != nil {
		slog.Warn("build driver season results from events failed",
			"slug", slug,
			"season", season,
			"err", errSeason,
		)
		seasonResults = nil
	}

	if st == nil {
		if hasProfile {
			writeDriverProfileOnly(w, slug, profile, profiles, redirects, seasonResults)
			return
		}
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	drivers, err := st.GetDriversBySlug(r.Context(), slug)
	if err != nil {
		slog.Error("get driver by slug failed",
			"slug", slug,
			"err", err,
			"trace_id", TraceID(r.Context()),
		)
		writeError(w, http.StatusInternalServerError, "failed to get driver")
		return
	}
	if len(drivers) == 0 {
		if hasProfile {
			writeDriverProfileOnly(w, slug, profile, profiles, redirects, seasonResults)
			return
		}
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	// Pick the record with the most filled fields (nationality, birth_date, birth_place).
	var found *models.Driver
	for i := range drivers {
		d := &drivers[i]
		if found == nil || driverFilledScore(d) > driverFilledScore(found) {
			found = d
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	birthStr := ""
	if !found.BirthDate.IsZero() {
		birthStr = found.BirthDate.Format("2006-01-02")
	}

	// Profile fills bio/photo; display name stays from race data (found.Name).
	if p, ok := profiles[slugKey]; ok {
		if strings.TrimSpace(p.Citizenship) != "" {
			found.Nationality = p.Citizenship
		}
		if strings.TrimSpace(p.BirthPlace) != "" {
			found.BirthPlace = p.BirthPlace
		}
		if strings.TrimSpace(p.BirthDate) != "" {
			if t, err := time.Parse("2006-01-02", p.BirthDate); err == nil {
				found.BirthDate = t
				birthStr = t.Format("2006-01-02")
			}
		}
	}

	displayName := strings.TrimSpace(found.Name)
	if displayName == "" {
		if p, ok := profiles[slugKey]; ok {
			displayName = profileDisplayName(slugKey, p)
		}
	}

	resp := map[string]interface{}{
		"name":            displayName,
		"nationality":     found.Nationality,
		"citizenship":     found.Nationality,
		"birth_date":      birthStr,
		"birth_place":     found.BirthPlace,
		"canonical_slug":  canonicalSlug,
		"photo_url": func() string {
			if profiles == nil {
				return ""
			}
			if p, ok := profiles[slugKey]; ok && strings.TrimSpace(p.PhotoURL) != "" {
				return p.PhotoURL
			}
			return ""
		}(),
		"death_date": func() string {
			if profiles == nil {
				return ""
			}
			if p, ok := profiles[slugKey]; ok {
				return strings.TrimSpace(p.DeathDate)
			}
			return ""
		}(),
		"season":         season,
		"season_results": seasonResults,
	}
	if p, ok := profiles[slugKey]; ok {
		attachProfileMetadata(resp, slugKey, p, displayName)
	}
	attachDriverPrimaryContext(resp, seasonResults)
	if err := jsonMarshalTo(w, resp); err != nil {
		slog.Warn("jsonMarshalTo failed", "slug", slug, "err", err)
	}
}

func writeDriverProfileOnly(w http.ResponseWriter, requestSlug string, p driverProfile, profiles map[string]driverProfile, redirects map[string]string, seasonResults []models.DriverSeasonResult) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	profileSlug := resolveDriverProfileSlug(driverutil.Slug(requestSlug), profiles, redirects)
	displayName := profileDisplayName(profileSlug, p)
	resp := map[string]interface{}{
		"name":           displayName,
		"nationality":    strings.TrimSpace(p.Citizenship),
		"citizenship":    strings.TrimSpace(p.Citizenship),
		"birth_date":     strings.TrimSpace(p.BirthDate),
		"birth_place":    strings.TrimSpace(p.BirthPlace),
		"death_date":     strings.TrimSpace(p.DeathDate),
		"photo_url":      strings.TrimSpace(p.PhotoURL),
		"canonical_slug": profileSlug,
		"season":         config.CurrentSeason,
		"season_results": seasonResults,
	}
	attachProfileMetadata(resp, profileSlug, p, displayName)
	attachDriverPrimaryContext(resp, seasonResults)
	_ = jsonMarshalTo(w, resp)
}

func attachDriverPrimaryContext(resp map[string]interface{}, seasonResults []models.DriverSeasonResult) {
	primary := schedulefile.PickDriverPrimaryContextFromResults(seasonResults)
	if strings.TrimSpace(primary.SeriesID) == "" {
		return
	}
	resp["primary_series_id"] = primary.SeriesID
	resp["primary_series_name"] = primary.SeriesName
	resp["primary_team_name"] = primary.TeamName
	resp["primary_starts"] = primary.Starts
}

var (
	driverPrimaryContextMu    sync.RWMutex
	driverPrimaryContext      map[string]schedulefile.DriverPrimaryContext
	driverPrimaryContextKey   string
	driverPrimaryContextErr   error
)

func loadDriverPrimaryContext(dataDir, season string) (map[string]schedulefile.DriverPrimaryContext, error) {
	season = strings.TrimSpace(season)
	if season == "" {
		season = config.CurrentSeason
	}
	cacheKey := dataDir + "|" + season

	driverPrimaryContextMu.RLock()
	if driverPrimaryContext != nil && driverPrimaryContextKey == cacheKey && driverPrimaryContextErr == nil {
		cached := driverPrimaryContext
		driverPrimaryContextMu.RUnlock()
		return cached, nil
	}
	driverPrimaryContextMu.RUnlock()

	m, err := schedulefile.BuildAllDriverPrimaryContext(dataDir, season)
	driverPrimaryContextMu.Lock()
	driverPrimaryContext = m
	driverPrimaryContextKey = cacheKey
	driverPrimaryContextErr = err
	driverPrimaryContextMu.Unlock()
	return m, err
}

func handleDriversPrimaryContext(w http.ResponseWriter, r *http.Request, dataDir string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	season := strings.TrimSpace(r.URL.Query().Get("season"))
	if season == "" {
		season = config.CurrentSeason
	}
	m, err := loadDriverPrimaryContext(dataDir, season)
	if err != nil {
		slog.Warn("build driver primary context failed", "season", season, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to build driver primary context")
		return
	}
	if m == nil {
		m = map[string]schedulefile.DriverPrimaryContext{}
	}
	if err := jsonMarshalTo(w, m); err != nil {
		slog.Warn("jsonMarshalTo failed", "endpoint", "/api/drivers/primary-context", "err", err)
	}
}

func getDriverPhotoURL(slug, dataDir string) string {
	profiles, _ := loadDriverProfiles(dataDir)
	redirects, _ := loadDriverProfileRedirects(dataDir)
	if profiles == nil {
		return ""
	}
	slugKey := resolveDriverProfileSlug(driverutil.Slug(slug), profiles, redirects)
	if p, ok := profiles[slugKey]; ok && strings.TrimSpace(p.PhotoURL) != "" {
		return strings.TrimSpace(p.PhotoURL)
	}
	return ""
}

func handleDriverThumbnail(w http.ResponseWriter, r *http.Request, dataDir string) {
	slug := strings.TrimPrefix(r.URL.Path, "/api/driver-thumb/")
	slug = strings.TrimSpace(strings.TrimRight(slug, "/"))
	if slug == "" {
		writeError(w, http.StatusBadRequest, "missing driver slug")
		return
	}
	slug = driverutil.NormalizeSlug(slug)
	photoURL := getDriverPhotoURL(slug, dataDir)
	if photoURL == "" {
		http.NotFound(w, r)
		return
	}

	cacheDir := filepath.Join(dataDir, "cache", "driver_thumbs")
	cachePath := filepath.Join(cacheDir, driverutil.Slug(slug)+".v2.jpg")
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(b)
		return
	}

	driverThumbsMu.Lock()
	defer driverThumbsMu.Unlock()
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Cache-Control", "public, max-age=86400")
		_, _ = w.Write(b)
		return
	}

	src, err := loadDriverSourceImage(photoURL, dataDir)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	const outW = 88
	const outH = 112
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	if srcW <= 0 || srcH <= 0 {
		http.NotFound(w, r)
		return
	}
	// Preserve the full source image (contain), avoiding aggressive face/body cropping.
	scale := float64(outW) / float64(srcW)
	if hScale := float64(outH) / float64(srcH); hScale < scale {
		scale = hScale
	}
	drawW := int(float64(srcW) * scale)
	drawH := int(float64(srcH) * scale)
	if drawW < 1 {
		drawW = 1
	}
	if drawH < 1 {
		drawH = 1
	}
	offX := (outW - drawW) / 2
	offY := (outH - drawH) / 2

	dst := image.NewRGBA(image.Rect(0, 0, outW, outH))
	bg := image.NewUniform(color.RGBA{R: 12, G: 14, B: 18, A: 255})
	draw.Draw(dst, dst.Bounds(), bg, image.Point{}, draw.Src)
	dstRect := image.Rect(offX, offY, offX+drawW, offY+drawH)
	draw.CatmullRom.Scale(dst, dstRect, src, bounds, draw.Over, nil)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 90}); err != nil {
		http.NotFound(w, r)
		return
	}
	if err := os.MkdirAll(cacheDir, 0o750); err == nil {
		_ = os.WriteFile(cachePath, out.Bytes(), 0o600)
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	_, _ = w.Write(out.Bytes())
}

func loadDriverSourceImage(photoURL, dataDir string) (image.Image, error) {
	raw := strings.TrimSpace(photoURL)
	if raw == "" {
		return nil, os.ErrNotExist
	}
	if isLocalDriverPhoto(raw) {
		localPath := resolveLocalDriverPhotoPath(raw, dataDir)
		f, err := os.Open(localPath) //nolint:gosec
		if err != nil {
			return nil, err
		}
		defer func() { _ = f.Close() }()
		src, _, err := image.Decode(f)
		return src, err
	}

	client := &http.Client{Timeout: 4 * time.Second}
	resp, err := client.Get(raw) // #nosec G107 -- URL is controlled by local driver profiles
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, os.ErrNotExist
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		return nil, err
	}
	src, _, err := image.Decode(bytes.NewReader(body))
	return src, err
}

func isLocalDriverPhoto(v string) bool {
	s := strings.TrimSpace(strings.ToLower(v))
	return strings.HasPrefix(s, "/web/") || strings.HasPrefix(s, "web/") || filepath.IsAbs(v)
}

func resolveLocalDriverPhotoPath(raw, dataDir string) string {
	raw = strings.TrimSpace(raw)
	if u, err := url.PathUnescape(raw); err == nil {
		raw = u
	}
	if filepath.IsAbs(raw) {
		return raw
	}
	repoRoot := filepath.Dir(dataDir)
	raw = strings.TrimPrefix(raw, "/")
	return filepath.Join(repoRoot, filepath.FromSlash(raw))
}

func jsonMarshalTo(w http.ResponseWriter, v interface{}) error {
	err := json.NewEncoder(w).Encode(v)
	if err != nil {
		slog.Warn("json encode failed", "err", err)
	}
	return err
}
