package main

import (
	"testing"
	"time"
)

func TestComputedResponseCache_HitUntilSourceMtimeChanges(t *testing.T) {
	c := newComputedResponseCache(time.Minute)
	mtime := time.Unix(1000, 0)
	body := []byte(`{"ok":true}`)
	c.Set("k", mtime, body)

	got, ok := c.Get("k", mtime)
	if !ok || string(got) != string(body) {
		t.Fatalf("cache miss or wrong body: ok=%v body=%q", ok, got)
	}

	newer := mtime.Add(time.Second)
	if _, ok := c.Get("k", newer); ok {
		t.Fatal("expected miss when source mtime is newer than cached entry")
	}
}

func TestComputedResponseCache_ExpiresAfterTTL(t *testing.T) {
	c := newComputedResponseCache(20 * time.Millisecond)
	mtime := time.Unix(2000, 0)
	c.Set("k", mtime, []byte("x"))
	time.Sleep(30 * time.Millisecond)
	if _, ok := c.Get("k", mtime); ok {
		t.Fatal("expected TTL expiry")
	}
}
