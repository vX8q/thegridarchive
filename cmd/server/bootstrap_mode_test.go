package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBootstrapModeFromEnv(t *testing.T) {
	t.Setenv("TGA_BOOTSTRAP", "incremental")
	if got := bootstrapModeFromEnv(); got != "incremental" {
		t.Fatalf("got %q", got)
	}
	t.Setenv("TGA_BOOTSTRAP", "")
	if got := bootstrapModeFromEnv(); got != "full" {
		t.Fatalf("default got %q", got)
	}
}

func TestDataJSONNewerThan(t *testing.T) {
	dir := t.TempDir()
	sched := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(sched, 0o755); err != nil {
		t.Fatal(err)
	}
	f := filepath.Join(sched, "x.json")
	if err := os.WriteFile(f, []byte("[]"), 0o644); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Hour)
	if !dataJSONNewerThan(dir, past) {
		t.Fatal("expected newer than past stamp")
	}
	future := time.Now().Add(time.Hour)
	if dataJSONNewerThan(dir, future) {
		t.Fatal("expected not newer than future stamp")
	}
}

func TestBootstrapStampRoundTrip(t *testing.T) {
	dir := t.TempDir()
	now := time.Unix(1_700_000_000, 0)
	if err := writeBootstrapStamp(dir, now); err != nil {
		t.Fatal(err)
	}
	got, ok := readBootstrapStamp(dir)
	if !ok || !got.Equal(now) {
		t.Fatalf("got %v ok=%v", got, ok)
	}
}
