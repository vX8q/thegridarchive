package main

import (
	"net"
	"net/http"
	"strings"
)

var clientIPTrustedProxy bool

func setClientIPTrustedProxy(enabled bool) {
	clientIPTrustedProxy = enabled
}

// clientIP returns the client IP for rate limiting and feedback hashing.
// Without TGA_TRUSTED_PROXY=1, only RemoteAddr is used (X-Forwarded-For is ignored).
func clientIP(r *http.Request) string {
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if !clientIPTrustedProxy {
		return ip
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		return strings.TrimSpace(strings.SplitN(fwd, ",", 2)[0])
	}
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}
	return ip
}
