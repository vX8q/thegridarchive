package main

import (
	"sync"
	"time"
)

const seriesComputedCacheTTL = 45 * time.Second

type computedCacheEntry struct {
	body        []byte
	sourceMtime time.Time
	expires     time.Time
}

type computedResponseCache struct {
	mu      sync.RWMutex
	ttl     time.Duration
	entries map[string]computedCacheEntry
}

func newComputedResponseCache(ttl time.Duration) *computedResponseCache {
	if ttl <= 0 {
		ttl = seriesComputedCacheTTL
	}
	return &computedResponseCache{
		ttl:     ttl,
		entries: make(map[string]computedCacheEntry),
	}
}

func (c *computedResponseCache) Get(key string, sourceMtime time.Time) ([]byte, bool) {
	if c == nil {
		return nil, false
	}
	now := time.Now()
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || entry.expires.Before(now) || entry.sourceMtime.Before(sourceMtime) {
		return nil, false
	}
	return entry.body, true
}

func (c *computedResponseCache) Set(key string, sourceMtime time.Time, body []byte) {
	if c == nil || len(body) == 0 {
		return
	}
	c.mu.Lock()
	c.entries[key] = computedCacheEntry{
		body:        append([]byte(nil), body...),
		sourceMtime: sourceMtime,
		expires:     time.Now().Add(c.ttl),
	}
	c.mu.Unlock()
}

var seriesResponseCache = newComputedResponseCache(seriesComputedCacheTTL)
