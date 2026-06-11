package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/store"
	"github.com/vX8q/tga/models"
)

func testDataDir(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for _, rel := range []string{"data", filepath.Join("..", "..", "data")} {
		dir := filepath.Clean(filepath.Join(wd, rel))
		if _, err := os.Stat(filepath.Join(dir, "driver_profiles.json")); err == nil {
			return dir
		}
	}
	t.Fatal("driver_profiles.json not found")
	return ""
}

func TestHandleDriverBySlug_EmptySlug(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/driver/", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, "data", store.NoopStore{})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["error"] == "" {
		t.Errorf("expected error message")
	}
}

func TestHandleDriverBySlug_NotFound(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/driver/nonexistent-slug", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, "data", store.NoopStore{})
	if rec.Code != http.StatusNotFound {
		t.Errorf("got status %d, want 404", rec.Code)
	}
}

func TestHandleDriverBySlug_Found(t *testing.T) {
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()
	ctx := context.Background()
	driver := &models.Driver{
		ID:          "F1:DRIVER:lewis_hamilton",
		Name:        "Lewis Hamilton",
		Nationality: "British",
		BirthDate:   time.Date(1985, 1, 7, 0, 0, 0, 0, time.UTC),
	}
	if err := st.UpsertDriver(ctx, driver); err != nil {
		t.Fatalf("UpsertDriver: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/driver/lewis-hamilton", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, "data", st)
	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["name"] != "Lewis Hamilton" || body["nationality"] != "British" {
		t.Errorf("body = %v", body)
	}
	if body["birth_date"] != "1985-01-07" {
		t.Errorf("birth_date = %q", body["birth_date"])
	}
}

func TestHandleDriverBySlug_KyleBuschDeathDate(t *testing.T) {
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()
	ctx := context.Background()
	driver := &models.Driver{
		ID:          "NASCAR:DRIVER:kyle_busch",
		Name:        "Kyle Busch",
		Nationality: "American",
	}
	if err := st.UpsertDriver(ctx, driver); err != nil {
		t.Fatalf("UpsertDriver: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/driver/kyle-busch", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, testDataDir(t), st)
	if rec.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200", rec.Code)
	}
	var body map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["death_date"] != "2026-05-21" {
		t.Errorf("death_date = %v, want 2026-05-21", body["death_date"])
	}
}

func TestHandleDriverBySlug_NilStore(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/driver/some-slug", nil)
	rec := httptest.NewRecorder()
	handleDriverBySlug(rec, req, "data", nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("got status %d, want 404", rec.Code)
	}
}

func TestHandleSeriesList(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/series", nil)
	rec := httptest.NewRecorder()
	handleSeriesList(rec, req, store.NoopStore{})
	if rec.Code != http.StatusOK {
		t.Errorf("got status %d, want 200", rec.Code)
	}
	var list []map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&list); err != nil {
		t.Fatal(err)
	}
	if len(list) == 0 {
		t.Error("expected non-empty series list from config")
	}
}

func TestHandleSeries_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/series/../etc/passwd", nil)
	rec := httptest.NewRecorder()
	handleSeries(rec, req, "data", store.NoopStore{})
	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", rec.Code)
	}
}

func TestHandleEvent_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/events/../../../etc/passwd", nil)
	rec := httptest.NewRecorder()
	handleEvent(rec, req, "data", nil)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", rec.Code)
	}
}

func TestHandleEvent_NotFound(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/events/NONEXISTENT_EVENT_999", nil)
	rec := httptest.NewRecorder()
	handleEvent(rec, req, "data", nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("got status %d, want 404", rec.Code)
	}
}
