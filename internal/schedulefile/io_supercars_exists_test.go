package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestEventDetailFileExists_doesNotAliasScheduleRaceNumber(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	if EventDetailFileExists(dataDir, "supercars_2026_7") {
		t.Skip("supercars_2026_7.json already on disk")
	}
	if !EventDetailExists(dataDir, "SUPERCARS_2026_7") {
		t.Fatal("schedule SUPERCARS_2026_7 should resolve to existing Melbourne weekend file")
	}
}
