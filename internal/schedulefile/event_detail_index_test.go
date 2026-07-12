package schedulefile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEventDetailFileSet_AndEventHasDetail(t *testing.T) {
	dir := t.TempDir()
	eventsDir := filepath.Join(dir, "events", "F1", "2026")
	if err := os.MkdirAll(eventsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(eventsDir, "f1_2026_1.json")
	if err := os.WriteFile(path, []byte(`{"id":"F1_2026_1"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	set := EventDetailFileSet(dir)
	if !EventHasDetail(dir, set, "F1_2026_1") {
		t.Fatal("expected detail for F1_2026_1")
	}
	if EventHasDetail(dir, set, "F1_2026_99") {
		t.Fatal("unexpected detail for missing event")
	}
}
