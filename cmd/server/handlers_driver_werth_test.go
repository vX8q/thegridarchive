package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestProfileDisplayName_AliasSlugDoesNotShortenWhenCanonicalUsed(t *testing.T) {
	p := driverProfile{FullName: "Christopher Werth"}
	// Alias slug shortens via slugUsesDifferentFirstName — callers must resolve first.
	if got := profileDisplayName("chris-werth", p); got != "Chris Werth" {
		t.Fatalf("alias slug display = %q, want Chris Werth (documents why resolve-first matters)", got)
	}
	if got := profileDisplayName("christopher-werth", p); got != "Christopher Werth" {
		t.Fatalf("canonical display = %q, want Christopher Werth", got)
	}
}

func TestDriversList_WerthUsesCanonicalName(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dataDir := filepath.Join(filepath.Dir(file), "..", "..", "data")

	req := httptest.NewRequest(http.MethodGet, "/api/drivers", nil)
	rr := httptest.NewRecorder()
	handleDriversList(rr, req, dataDir, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	var items []struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &items); err != nil {
		t.Fatal(err)
	}
	var found []string
	for _, it := range items {
		if strings.Contains(strings.ToLower(it.Name), "werth") || strings.Contains(it.Slug, "werth") {
			found = append(found, it.Slug+"|"+it.Name)
		}
	}
	if len(found) != 1 || found[0] != "christopher-werth|Christopher Werth" {
		t.Fatalf("unexpected werth entries: %v", found)
	}
}

func TestDriversList_SkipsRedirectAliasKeys(t *testing.T) {
	dir := t.TempDir()
	profiles := map[string]driverProfile{
		"christopher-werth": {FullName: "Christopher Werth", BirthDate: "1974-09-16"},
		// Stub alias key that must not become its own search hit.
		"chris-werth": {FullName: "Christopher Werth", BirthDate: "1974-09-16"},
	}
	redirects := map[string]string{"chris-werth": "christopher-werth"}
	writeWerthTestJSON(t, filepath.Join(dir, "driver_profiles.json"), profiles)
	writeWerthTestJSON(t, filepath.Join(dir, "driver_profile_redirects.json"), redirects)

	req := httptest.NewRequest(http.MethodGet, "/api/drivers", nil)
	rr := httptest.NewRecorder()
	handleDriversList(rr, req, dir, nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	var items []struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &items); err != nil {
		t.Fatal(err)
	}
	var found []string
	for _, it := range items {
		if strings.Contains(it.Slug, "werth") {
			found = append(found, it.Slug+"|"+it.Name)
		}
	}
	if len(found) != 1 || found[0] != "christopher-werth|Christopher Werth" {
		t.Fatalf("expected one canonical hit, got %v", found)
	}
}

func writeWerthTestJSON(t *testing.T, path string, v interface{}) {
	t.Helper()
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, append(b, '\n'), 0o600); err != nil {
		t.Fatal(err)
	}
}
