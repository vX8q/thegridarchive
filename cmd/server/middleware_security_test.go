package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSetSecurityHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	setSecurityHeaders(rec)
	if got := rec.Header().Get("X-Frame-Options"); got != "SAMEORIGIN" {
		t.Fatalf("X-Frame-Options = %q, want SAMEORIGIN", got)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("X-Content-Type-Options = %q, want nosniff", got)
	}
	csp := rec.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Fatal("expected Content-Security-Policy header")
	}
	if !strings.Contains(csp, "default-src 'self'") {
		t.Fatalf("CSP missing default-src: %q", csp)
	}
	if !strings.Contains(csp, "challenges.cloudflare.com") {
		t.Fatalf("CSP missing Turnstile host: %q", csp)
	}
}

func TestWrapWithAdminToken_OptionsDoesNotReachHandler(t *testing.T) {
	called := false
	h := wrapWithAdminToken("secret", func(w http.ResponseWriter, _ *http.Request) {
		called = true
		_, _ = w.Write([]byte("protected body"))
	})
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodOptions, "/metrics", nil))

	if called {
		t.Fatal("OPTIONS reached the protected handler — admin token bypass")
	}
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatal("preflight response is missing CORS origin header")
	}
}

func TestWrapWithMetricsAccess_OptionsWithoutTokenIsNotServed(t *testing.T) {
	h := wrapWithMetricsAccess("secret", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("tga_requests_total 1"))
	})
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodOptions, "/metrics", nil))

	if strings.Contains(rec.Body.String(), "tga_requests_total") {
		t.Fatalf("metrics leaked to an unauthenticated OPTIONS request: %q", rec.Body.String())
	}
}

func TestWrapWithLogging_SetsSecurityHeaders(t *testing.T) {
	h := wrapWithLogging(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/api/series", nil))
	if rec.Header().Get("X-Frame-Options") == "" {
		t.Fatal("expected security headers on logged responses")
	}
}
