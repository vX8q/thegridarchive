package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

var (
	countryFlagsMu sync.Mutex
	reFlagISO      = regexp.MustCompile(`^[a-z]{2}$`)
)

func handleCountryFlag(w http.ResponseWriter, r *http.Request, dataDir string) {
	rest := strings.TrimPrefix(r.URL.Path, "/api/flag/")
	rest = strings.TrimSpace(strings.TrimRight(rest, "/"))
	iso := strings.ToLower(strings.TrimSuffix(rest, ".png"))
	if !reFlagISO.MatchString(iso) {
		writeError(w, http.StatusBadRequest, "invalid country code")
		return
	}

	cacheDir := filepath.Join(dataDir, "cache", "flags")
	cachePath := filepath.Join(cacheDir, iso+".png")

	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=604800")
		_, _ = w.Write(b)
		return
	}

	countryFlagsMu.Lock()
	defer countryFlagsMu.Unlock()

	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "public, max-age=604800")
		_, _ = w.Write(b)
		return
	}

	b, err := fetchFlagPNG(iso)
	if err != nil || len(b) == 0 {
		http.NotFound(w, r)
		return
	}
	if err := os.MkdirAll(cacheDir, 0o750); err == nil {
		_ = os.WriteFile(cachePath, b, 0o600)
	}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=604800")
	_, _ = w.Write(b)
}

func fetchFlagPNG(iso string) ([]byte, error) {
	srcURL := "https://flagcdn.com/w40/" + iso + ".png"
	client := &http.Client{Timeout: 8 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 250 * time.Millisecond)
		}
		resp, err := client.Get(srcURL) // #nosec G107 -- fixed flag CDN URL from validated ISO code
		if err != nil {
			lastErr = err
			continue
		}
		b, readErr := func() ([]byte, error) {
			defer func() { _ = resp.Body.Close() }()
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				return nil, fmt.Errorf("flagcdn status %d", resp.StatusCode)
			}
			b, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
			if err != nil {
				return nil, err
			}
			if len(b) == 0 {
				return nil, fmt.Errorf("empty flag body")
			}
			return b, nil
		}()
		if readErr != nil {
			lastErr = readErr
			continue
		}
		return b, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("flag fetch failed")
	}
	return nil, lastErr
}
