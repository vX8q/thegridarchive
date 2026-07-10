package main

import (
	"net"
	"net/url"
	"strings"
)

// allowedRemoteImageHosts is the explicit host allowlist for server-side image fetches
// (driver_profiles.json photo_url, team_logos.json URLs).
var allowedRemoteImageHosts = map[string]struct{}{
	"a.espncdn.com":          {},
	"upload.wikimedia.org":   {},
	"commons.wikimedia.org":  {},
}

func allowedRemoteImageURL(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return "", false
	}
	if u.Scheme != "https" {
		return "", false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" || blockedImageHost(host) || !allowedImageHost(host) {
		return "", false
	}
	return u.String(), true
}

func blockedImageHost(host string) bool {
	if host == "localhost" ||
		strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".local") ||
		strings.HasSuffix(host, ".internal") {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

func allowedImageHost(host string) bool {
	if _, ok := allowedRemoteImageHosts[host]; ok {
		return true
	}
	return strings.HasSuffix(host, ".wikimedia.org")
}
