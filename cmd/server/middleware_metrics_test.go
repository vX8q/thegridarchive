package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWrapWithMetricsAccess_LoopbackWithoutToken(t *testing.T) {
	called := false
	h := wrapWithMetricsAccess("", func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !called {
		t.Fatal("handler was not called for loopback request")
	}
}

func TestWrapWithMetricsAccess_RemoteWithoutTokenForbidden(t *testing.T) {
	h := wrapWithMetricsAccess("", func(_ http.ResponseWriter, _ *http.Request) {
		t.Fatal("handler should not be called")
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "203.0.113.10:12345"
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestWrapWithMetricsAccess_AdminTokenRequired(t *testing.T) {
	h := wrapWithMetricsAccess("secret-token", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req.RemoteAddr = "127.0.0.1:12345"
	rec := httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 without token", rec.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	req2.RemoteAddr = "203.0.113.10:12345"
	req2.Header.Set("X-Admin-Token", "secret-token")
	rec2 := httptest.NewRecorder()
	h(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 with valid token", rec2.Code)
	}
}
