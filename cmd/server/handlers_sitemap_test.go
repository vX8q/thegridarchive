package main

import (
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleSitemap_PublicPages(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://example.com/sitemap.xml", nil)
	rec := httptest.NewRecorder()
	handleSitemap(rec, req, testDataDir(t))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if !strings.HasPrefix(ct, "application/xml") {
		t.Fatalf("Content-Type = %q, want application/xml", ct)
	}

	body := rec.Body.String()
	var parsed sitemapURLSet
	if err := xml.Unmarshal(rec.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("invalid sitemap XML: %v\n%s", err, body)
	}
	if len(parsed.URLs) == 0 {
		t.Fatal("sitemap has no urls")
	}

	locs := make([]string, 0, len(parsed.URLs))
	for _, u := range parsed.URLs {
		locs = append(locs, u.Loc)
	}
	joined := strings.Join(locs, "\n")
	if !strings.Contains(joined, "http://example.com/") {
		t.Error("sitemap missing home /")
	}
	if !strings.Contains(joined, "http://example.com/series/f2") {
		t.Error("sitemap missing known series /series/f2")
	}
	if !strings.Contains(joined, "http://example.com/driver/max-verstappen") {
		t.Error("sitemap missing known driver /driver/max-verstappen")
	}
	if !strings.Contains(joined, "http://example.com/team/haas-factory-team") {
		t.Error("sitemap missing known team /team/haas-factory-team")
	}
	if strings.Contains(joined, "/api/") {
		t.Error("sitemap must not list /api/ URLs")
	}
}

func TestHandleRobots_SitemapLine(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://example.com/robots.txt", nil)
	rec := httptest.NewRecorder()
	handleRobots(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "Sitemap: http://example.com/sitemap.xml") {
		t.Fatalf("robots.txt missing Sitemap line, body = %q", body)
	}
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "Disallow: /api/" || line == "Disallow: /api" {
			t.Fatalf("robots.txt must not blanket-disallow /api/, body = %q", body)
		}
	}
}

func TestRequestPublicOrigin_HostAndScheme(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://archive.example/sitemap.xml", nil)
	if got := requestPublicOrigin(req); got != "http://archive.example" {
		t.Fatalf("origin = %q, want http://archive.example", got)
	}
}

func TestRequestPublicOrigin_ForwardedProtoTrustedProxy(t *testing.T) {
	prev := clientIPTrustedProxy
	setClientIPTrustedProxy(true)
	defer setClientIPTrustedProxy(prev)

	req := httptest.NewRequest(http.MethodGet, "http://archive.example/sitemap.xml", nil)
	req.Header.Set("X-Forwarded-Proto", "https, http")
	if got := requestPublicOrigin(req); got != "https://archive.example" {
		t.Fatalf("trusted proxy origin = %q, want https://archive.example", got)
	}

	setClientIPTrustedProxy(false)
	req2 := httptest.NewRequest(http.MethodGet, "http://archive.example/sitemap.xml", nil)
	req2.Header.Set("X-Forwarded-Proto", "https")
	if got := requestPublicOrigin(req2); got != "http://archive.example" {
		t.Fatalf("untrusted proxy must ignore X-Forwarded-Proto, got %q", got)
	}
}
