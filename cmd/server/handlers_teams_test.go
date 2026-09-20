package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vX8q/tga/internal/schedulefile"
)

func TestHandleAllSeriesTeams_HasCoreSeries(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	req := httptest.NewRequest(http.MethodGet, "/api/teams?season=2026", nil)
	rec := httptest.NewRecorder()
	handleAllSeriesTeams(rec, req, dataDir)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body = %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Season   string                     `json:"season"`
		BySeries map[string]json.RawMessage `json:"by_series"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Season != "2026" {
		t.Fatalf("season = %q, want 2026", payload.Season)
	}
	for _, id := range []string{"f1", "nascar_cup", "imsa", "noaps"} {
		if _, ok := payload.BySeries[id]; !ok {
			t.Errorf("missing by_series[%s]", id)
		}
	}
	if rec.Header().Get("Content-Type") == "" {
		t.Error("missing Content-Type")
	}
}

func TestHandleAllSeriesTeams_EarlyCacheSkipsBuild(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	sentinel := `{"season":"2026","by_series":{},"_cache_sentinel":true}`
	mtime := schedulefile.AllSeriesTeamsMaxMtime(dataDir)
	seriesResponseCache.Set("teams/_all/2026", mtime, []byte(sentinel))

	req := httptest.NewRequest(http.MethodGet, "/api/teams?season=2026", nil)
	rec := httptest.NewRecorder()
	handleAllSeriesTeams(rec, req, dataDir)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if rec.Body.String() != sentinel {
		t.Fatalf("early cache miss — build ran; body = %s", rec.Body.String())
	}
}

func TestHandleAllSeriesTeams_SecondRequestHitsCache(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	req := httptest.NewRequest(http.MethodGet, "/api/teams", nil)
	rec1 := httptest.NewRecorder()
	handleAllSeriesTeams(rec1, req, dataDir)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first status = %d", rec1.Code)
	}
	body1 := rec1.Body.String()
	if !strings.Contains(body1, `"by_series"`) {
		t.Fatalf("first body missing by_series: %s", body1[:min(200, len(body1))])
	}

	rec2 := httptest.NewRecorder()
	handleAllSeriesTeams(rec2, httptest.NewRequest(http.MethodGet, "/api/teams", nil), dataDir)
	if rec2.Body.String() != body1 {
		t.Fatal("cached all-teams body differs from first response")
	}
}
