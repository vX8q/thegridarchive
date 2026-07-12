package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/store"
	"github.com/vX8q/tga/models"
)

type failingDriverStore struct {
	store.NoopStore
}

func (f failingDriverStore) GetDriversBySlug(_ context.Context, _ string) ([]models.Driver, error) {
	return nil, errors.New("db unavailable")
}

func TestIntegrationAPI_SeriesListHappyPath(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/series", nil)
	rec := httptest.NewRecorder()

	handleSeriesList(rec, req, store.NoopStore{})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body []map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(body) == 0 {
		t.Fatal("series list is empty")
	}
}

func TestIntegrationAPI_EventUnknown404(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/events/UNKNOWN_EVENT_999", nil)
	rec := httptest.NewRecorder()

	handleEvent(rec, req, t.TempDir(), nil)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestIntegrationAPI_DriverHappyPath(t *testing.T) {
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()

	ctx := context.Background()
	if err := st.UpsertDriver(ctx, &models.Driver{
		ID:          "F1:DRIVER:lewis_hamilton",
		Name:        "Lewis Hamilton",
		Nationality: "British",
		BirthDate:   time.Date(1985, 1, 7, 0, 0, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("UpsertDriver: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/driver/lewis-hamilton", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, t.TempDir(), st)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestIntegrationAPI_DriverStoreError500(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/driver/lewis-hamilton", nil)
	rec := httptest.NewRecorder()

	handleDriverBySlug(rec, req, t.TempDir(), failingDriverStore{})

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestIntegrationAPI_AggregatedSchedule2026(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/schedule?season=2026", nil)
	rec := httptest.NewRecorder()

	handleAggregatedSchedule(rec, req, dataDir)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var payload struct {
		Season string `json:"season"`
		Events []struct {
			ID        string `json:"id"`
			SeriesID  string `json:"series_id"`
			HasDetail bool   `json:"has_detail"`
		} `json:"events"`
		Series map[string]string `json:"series"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload.Season != "2026" {
		t.Fatalf("season = %q, want 2026", payload.Season)
	}
	if len(payload.Events) < 80 {
		t.Fatalf("expected many 2026 events, got %d", len(payload.Events))
	}
	if payload.Series["F1"] == "" || payload.Series["NASCAR_CUP"] == "" {
		t.Fatalf("series name map incomplete: %#v", payload.Series)
	}
}

func TestIntegrationAPI_CupStandingsSmoke(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/cup/standings", nil)
	rec := httptest.NewRecorder()

	handleSeriesStandings(rec, req, dataDir, "NASCAR_CUP", "2026")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var data struct {
		Series string `json:"series"`
		Rows   []struct {
			Driver string `json:"driver"`
			Points string `json:"points"`
			Pos    int    `json:"pos"`
		} `json:"rows"`
		RaceOrder []string `json:"race_order"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&data); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(data.Rows) == 0 {
		t.Fatal("cup standings rows empty")
	}
	if data.Rows[0].Driver == "" || data.Rows[0].Points == "" {
		t.Fatalf("leader row incomplete: %#v", data.Rows[0])
	}
	if data.Rows[0].Pos < 1 {
		t.Fatalf("leader pos invalid: %d", data.Rows[0].Pos)
	}
	if len(data.RaceOrder) == 0 {
		t.Fatal("race_order empty")
	}
}

func TestIntegrationAPI_LiveEventsReturnsArray(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/live-events", nil)
	rec := httptest.NewRecorder()

	handleLiveEvents(rec, req, dataDir, store.NoopStore{})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var ids []string
	if err := json.NewDecoder(rec.Body).Decode(&ids); err != nil {
		t.Fatalf("decode live-events: %v", err)
	}
	if ids == nil {
		t.Fatal("live-events must return JSON array, not null")
	}
}
