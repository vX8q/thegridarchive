package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientIP_WithoutTrustedProxy_IgnoresForwardedFor(t *testing.T) {
	setClientIPTrustedProxy(false)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "203.0.113.10:12345"
	r.Header.Set("X-Forwarded-For", "198.51.100.1, 203.0.113.1")
	got := clientIP(r)
	if got != "203.0.113.10" {
		t.Fatalf("clientIP = %q, want direct RemoteAddr", got)
	}
}

func TestClientIP_WithTrustedProxy_UsesForwardedFor(t *testing.T) {
	setClientIPTrustedProxy(true)
	defer setClientIPTrustedProxy(false)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.1:443"
	r.Header.Set("X-Forwarded-For", "198.51.100.42, 10.0.0.1")
	got := clientIP(r)
	if got != "198.51.100.42" {
		t.Fatalf("clientIP = %q, want first X-Forwarded-For hop", got)
	}
}

func TestClientIP_WithTrustedProxy_FallsBackToRealIP(t *testing.T) {
	setClientIPTrustedProxy(true)
	defer setClientIPTrustedProxy(false)

	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.1:443"
	r.Header.Set("X-Real-IP", "198.51.100.7")
	got := clientIP(r)
	if got != "198.51.100.7" {
		t.Fatalf("clientIP = %q, want X-Real-IP", got)
	}
}

func TestRateLimiter_WithoutTrustedProxy_IgnoresSpoofedForwardedFor(t *testing.T) {
	setClientIPTrustedProxy(false)
	rl := newRateLimiter(1, 1)
	if rl == nil {
		t.Fatal("expected rate limiter")
	}

	r1 := httptest.NewRequest(http.MethodGet, "/", nil)
	r1.RemoteAddr = "203.0.113.10:12345"
	r1.Header.Set("X-Forwarded-For", "spoofed.example")
	if !rl.allow(r1) {
		t.Fatal("first request should be allowed")
	}
	if rl.allow(r1) {
		t.Fatal("second request from same RemoteAddr should be rate limited")
	}

	r2 := httptest.NewRequest(http.MethodGet, "/", nil)
	r2.RemoteAddr = "203.0.113.11:12345"
	r2.Header.Set("X-Forwarded-For", "spoofed.example")
	if !rl.allow(r2) {
		t.Fatal("different RemoteAddr should not share spoofed X-Forwarded-For bucket")
	}
}
