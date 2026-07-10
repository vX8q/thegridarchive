package main

import "testing"

func TestAllowedRemoteImageURL_ESPN(t *testing.T) {
	got, ok := allowedRemoteImageURL("https://a.espncdn.com/i/headshots/rpm/circuit/2026/123.png")
	if !ok {
		t.Fatal("expected ESPN CDN URL to be allowed")
	}
	if got == "" {
		t.Fatal("expected non-empty canonical URL")
	}
}

func TestAllowedRemoteImageURL_Wikimedia(t *testing.T) {
	_, ok := allowedRemoteImageURL("https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg")
	if !ok {
		t.Fatal("expected wikimedia upload host to be allowed")
	}
}

func TestAllowedRemoteImageURL_RejectsHTTP(t *testing.T) {
	_, ok := allowedRemoteImageURL("http://a.espncdn.com/logo.png")
	if ok {
		t.Fatal("expected http scheme to be rejected")
	}
}

func TestAllowedRemoteImageURL_RejectsPrivateIP(t *testing.T) {
	for _, u := range []string{
		"https://127.0.0.1/secret",
		"https://10.0.0.1/internal",
		"https://192.168.1.1/admin",
		"https://169.254.169.254/latest/meta-data/",
	} {
		if _, ok := allowedRemoteImageURL(u); ok {
			t.Fatalf("expected %q to be rejected", u)
		}
	}
}

func TestAllowedRemoteImageURL_RejectsUnknownHost(t *testing.T) {
	_, ok := allowedRemoteImageURL("https://evil.example/steal.png")
	if ok {
		t.Fatal("expected unknown host to be rejected")
	}
}

func TestAllowedRemoteImageURL_RejectsLocalhost(t *testing.T) {
	_, ok := allowedRemoteImageURL("https://localhost/logo.png")
	if ok {
		t.Fatal("expected localhost to be rejected")
	}
}
