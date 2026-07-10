package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandleSeriesEvents_HasDetailRequiresEventFile(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/supercars/events?season=2026", nil)
	rec := httptest.NewRecorder()

	handleSeriesEvents(rec, req, dataDir, "SUPERCARS", nil, "2026")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	type row struct {
		ID        string `json:"id"`
		HasDetail bool   `json:"has_detail"`
	}
	var events []row
	if err := json.NewDecoder(rec.Body).Decode(&events); err != nil {
		t.Fatal(err)
	}

	var race20, race37 *row
	for i := range events {
		switch events[i].ID {
		case "SUPERCARS_2026_20":
			race20 = &events[i]
		case "SUPERCARS_2026_37":
			race37 = &events[i]
		}
	}
	if race37 == nil {
		t.Fatal("SUPERCARS_2026_37 missing from API response")
	}
	if race37.HasDetail {
		t.Fatal("future weekend without JSON should have has_detail=false")
	}
	if race20 == nil {
		t.Fatal("SUPERCARS_2026_20 missing from API response")
	}
	if !race20.HasDetail {
		t.Fatal("SUPERCARS_2026_20 should have has_detail=true when supercars_2026_7.json exists")
	}
}
