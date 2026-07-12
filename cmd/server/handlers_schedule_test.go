package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

func decodeAggregatedSchedule(t *testing.T, rec *httptest.ResponseRecorder) map[string]json.RawMessage {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var payload map[string]json.RawMessage
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return payload
}

func TestHandleAggregatedSchedule_ReturnsEvents(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	req := httptest.NewRequest(http.MethodGet, "/api/schedule?season=2026", nil)
	rec := httptest.NewRecorder()
	handleAggregatedSchedule(rec, req, dataDir)

	payload := decodeAggregatedSchedule(t, rec)

	var season string
	if err := json.Unmarshal(payload["season"], &season); err != nil {
		t.Fatal(err)
	}
	if season != "2026" {
		t.Fatalf("season = %q, want 2026", season)
	}

	type eventRow struct {
		ID       string `json:"id"`
		SeriesID string `json:"series_id"`
		Season   string `json:"season"`
		HasDetail bool  `json:"has_detail"`
	}
	var events []eventRow
	if err := json.Unmarshal(payload["events"], &events); err != nil {
		t.Fatal(err)
	}
	if len(events) < 80 {
		t.Fatalf("expected >80 aggregated 2026 events, got %d", len(events))
	}
	for _, e := range events {
		if e.Season != "2026" {
			t.Fatalf("event %s season = %q, want 2026", e.ID, e.Season)
		}
		if e.SeriesID == "" {
			t.Fatalf("event %s missing series_id", e.ID)
		}
	}

	var seriesNames map[string]string
	if err := json.Unmarshal(payload["series"], &seriesNames); err != nil {
		t.Fatal(err)
	}
	if len(seriesNames) < len(config.Championships) {
		t.Fatalf("series map len = %d, want >= %d", len(seriesNames), len(config.Championships))
	}
	for _, key := range []string{"F1", "NASCAR_CUP", "WEC", "ELMS"} {
		if seriesNames[key] == "" {
			t.Fatalf("series map missing %s", key)
		}
	}

	var withDetail, withoutDetail bool
	for _, e := range events {
		if e.HasDetail {
			withDetail = true
		} else {
			withoutDetail = true
		}
	}
	if !withDetail || !withoutDetail {
		t.Fatal("expected mix of has_detail true/false in aggregated schedule")
	}

	mtime := schedulefile.AggregatedScheduleMaxMtime(dataDir)
	if _, ok := seriesResponseCache.Get("schedule/all/2026", mtime); !ok {
		t.Fatal("expected aggregated schedule cache entry after first request")
	}

	rec2 := httptest.NewRecorder()
	handleAggregatedSchedule(rec2, req, dataDir)
	if rec2.Code != http.StatusOK {
		t.Fatalf("second status = %d", rec2.Code)
	}
	payload2 := decodeAggregatedSchedule(t, rec2)
	if len(payload2["events"]) != len(payload["events"]) {
		t.Fatalf("cached event payload size differs: %d vs %d", len(payload2["events"]), len(payload["events"]))
	}
	var season2 string
	if err := json.Unmarshal(payload2["season"], &season2); err != nil {
		t.Fatal(err)
	}
	if season2 != season {
		t.Fatalf("cached season = %q, want %q", season2, season)
	}
}

func TestHandleAggregatedSchedule_InvalidSeason400(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/schedule?season=abc", nil)
	rec := httptest.NewRecorder()
	handleAggregatedSchedule(rec, req, dataDir)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestHandleAggregatedSchedule_SeasonFilterExcludesOtherYears(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/schedule?season=2025", nil)
	rec := httptest.NewRecorder()
	handleAggregatedSchedule(rec, req, dataDir)
	payload := decodeAggregatedSchedule(t, rec)

	var events []struct {
		ID     string `json:"id"`
		Season string `json:"season"`
	}
	if err := json.Unmarshal(payload["events"], &events); err != nil {
		t.Fatal(err)
	}
	for _, e := range events {
		if e.Season != "2025" {
			t.Fatalf("event %s season = %q in 2025 filter response", e.ID, e.Season)
		}
		if strings.Contains(e.ID, "_2026_") {
			t.Fatalf("2026 event %s leaked into season=2025 response", e.ID)
		}
	}
}
