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
