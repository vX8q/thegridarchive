// Package cache provides in-memory caching helpers.
package cache

import (
	"context"
	"sync"
	"time"
)

// TTL is a simple in-memory cache with TTL. Does not limit size (for small volumes).
// When ctx is cancelled, the cleanup goroutine exits (graceful shutdown).
type TTL struct {
	mu    sync.RWMutex
	items map[string]item
	ttl   time.Duration
	done  chan struct{}
}

type item struct {
	value   []byte
	expires time.Time
}

// NewTTL creates a cache with the given entry lifetime.
// ctx: when cancelled, stops the background cleanup goroutine.
func NewTTL(ctx context.Context, ttl time.Duration) *TTL {
	c := &TTL{
		items: make(map[string]item),
		ttl:   ttl,
		done:  make(chan struct{}),
	}
	if ttl > 0 {
		go c.cleanLoop(ctx)
	}
	return c
}

func (c *TTL) cleanLoop(ctx context.Context) {
	tick := time.NewTicker(c.ttl)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			close(c.done)
			return
		case <-tick.C:
			c.clean()
		}
	}
}

// Done returns a channel closed when the cleanup goroutine stops (for tests/shutdown wait).
func (c *TTL) Done() <-chan struct{} {
	return c.done
}

func (c *TTL) clean() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, v := range c.items {
		if v.expires.Before(now) {
			delete(c.items, k)
		}
	}
}

// Get returns the value for a key if it has not expired yet.
func (c *TTL) Get(key string) ([]byte, bool) {
	c.mu.RLock()
	v, ok := c.items[key]
	c.mu.RUnlock()
	if !ok || v.expires.Before(time.Now()) {
		return nil, false
	}
	return v.value, true
}

// Set stores a value with TTL.
func (c *TTL) Set(key string, value []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = item{value: value, expires: time.Now().Add(c.ttl)}
}
