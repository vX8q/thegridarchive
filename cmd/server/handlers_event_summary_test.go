package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestHandleEventSummaries_Batch(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	if _, err := filepath.Abs(dataDir); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/events/summaries?ids=F2_2026_7,INDYCAR_2026_5", nil)
	rec := httptest.NewRecorder()
	handleEvent(rec, req, dataDir)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	var out map[string]struct {
		ID      string `json:"id"`
		Winners []struct {
			Name string `json:"name"`
		} `json:"winners"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatalf("empty summaries: %s", rec.Body.String())
	}
}

func TestHandleEventSummary_Single(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	req := httptest.NewRequest(http.MethodGet, "/api/events/F2_2026_7/summary", nil)
	rec := httptest.NewRecorder()
	handleEvent(rec, req, dataDir)
	if rec.Code != http.StatusOK && rec.Code != http.StatusNotFound {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}
