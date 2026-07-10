package main

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	rateLimitCleanInterval = 2 * time.Minute
	rateLimitMaxAge        = 15 * time.Minute
)

type clientEntry struct {
	lim     *rate.Limiter
	lastSeen time.Time
}

// rateLimiter wraps rate.Limiter for use in middleware.
// Periodically removes client entries older than rateLimitMaxAge (prevents memory leaks).
type rateLimiter struct {
	mu        sync.Mutex
	limit     rate.Limit
	burst     int
	clients   map[string]*clientEntry
	lastClean time.Time
}

func newRateLimiter(rps float64, burst int) *rateLimiter {
	if rps <= 0 {
		return nil
	}
	return &rateLimiter{
		limit:     rate.Limit(rps),
		burst:     burst,
		clients:   make(map[string]*clientEntry),
		lastClean: time.Now(),
	}
}

func (rl *rateLimiter) allow(r *http.Request) bool {
	if rl == nil {
		return true
	}
	key := clientIP(r)
	if key == "" {
		key = "unknown"
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	if now.Sub(rl.lastClean) > rateLimitCleanInterval {
		for k, e := range rl.clients {
			if now.Sub(e.lastSeen) > rateLimitMaxAge {
				delete(rl.clients, k)
			}
		}
		rl.lastClean = now
	}
	e, ok := rl.clients[key]
	if !ok {
		e = &clientEntry{lim: rate.NewLimiter(rl.limit, rl.burst)}
		rl.clients[key] = e
	}
	e.lastSeen = now
	return e.lim.Allow()
}
