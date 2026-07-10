package schedulefile

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestSeriesDataMaxMtime_UsesEventAndScheduleFiles(t *testing.T) {
	dir := t.TempDir()
	schedulesDir := filepath.Join(dir, "schedules")
	eventsDir := filepath.Join(dir, "events", "NOAPS", "2026")
	if err := os.MkdirAll(schedulesDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	schedulePath := filepath.Join(schedulesDir, "noaps.json")
	eventPath := filepath.Join(eventsDir, "noaps_2026_1.json")
	if err := os.WriteFile(schedulePath, []byte("[]"), 0o600); err != nil {
		t.Fatal(err)
	}
	time.Sleep(10 * time.Millisecond)
	if err := os.WriteFile(eventPath, []byte(`{"tables":{}}`), 0o600); err != nil {
		t.Fatal(err)
	}

	eventFI, err := os.Stat(eventPath)
	if err != nil {
		t.Fatal(err)
	}
	got := SeriesDataMaxMtime(dir, "NOAPS", "2026")
	if !got.Equal(eventFI.ModTime()) {
		t.Fatalf("max mtime = %v, want event %v", got, eventFI.ModTime())
	}
}

func TestSeriesDataMaxMtime_IgnoresOtherSeason(t *testing.T) {
	dir := t.TempDir()
	events2025 := filepath.Join(dir, "events", "NOAPS", "2025")
	events2026 := filepath.Join(dir, "events", "NOAPS", "2026")
	if err := os.MkdirAll(events2025, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(events2026, 0o750); err != nil {
		t.Fatal(err)
	}
	oldPath := filepath.Join(events2025, "noaps_2025_1.json")
	newPath := filepath.Join(events2026, "noaps_2026_1.json")
	if err := os.WriteFile(oldPath, []byte(`{"tables":{}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	time.Sleep(10 * time.Millisecond)
	if err := os.WriteFile(newPath, []byte(`{"tables":{}}`), 0o600); err != nil {
		t.Fatal(err)
	}

	newFI, err := os.Stat(newPath)
	if err != nil {
		t.Fatal(err)
	}
	got := SeriesDataMaxMtime(dir, "NOAPS", "2026")
	if !got.Equal(newFI.ModTime()) {
		t.Fatalf("max mtime = %v, want 2026 event %v", got, newFI.ModTime())
	}
}
