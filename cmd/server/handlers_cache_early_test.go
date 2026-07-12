package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vX8q/tga/internal/schedulefile"
)

func TestHandleSeriesStandings_EarlyCacheSkipsBuild(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	sentinel := `{"series":"F1","rows":[],"_cache_sentinel":true}`
	mtime := schedulefile.SeriesDataMaxMtime(dataDir, "F1", "2026")
	seriesResponseCache.Set("standings/f1/2026", mtime, []byte(sentinel))

	req := httptest.NewRequest(http.MethodGet, "/api/series/f1/standings", nil)
	rec := httptest.NewRecorder()
	handleSeriesStandings(rec, req, dataDir, "F1", "2026")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body = %s", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != sentinel {
		t.Fatalf("early cache miss — build ran; body = %s", rec.Body.String())
	}
}

func TestHandleSeriesStats_EarlyCacheSkipsBuild(t *testing.T) {
	dataDir := testDataDir(t)
	seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)

	sentinel := `{"rows":[],"_cache_sentinel":true}`
	mtime := schedulefile.SeriesDataMaxMtime(dataDir, "F1", "2026")
	seriesResponseCache.Set("stats/f1/2026", mtime, []byte(sentinel))

	req := httptest.NewRequest(http.MethodGet, "/api/series/f1/stats", nil)
	rec := httptest.NewRecorder()
	handleSeriesStats(rec, req, dataDir, "F1", "2026")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200, body = %s", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != sentinel {
		t.Fatalf("early cache miss — build ran; body = %s", rec.Body.String())
	}
}
