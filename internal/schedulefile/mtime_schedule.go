package schedulefile

import (
	"os"
	"path/filepath"
	"strings"
	"time"
)

// AllSchedulesMaxMtime returns the latest mod time among data/schedules/*.json.
func AllSchedulesMaxMtime(dataDir string) time.Time {
	var latest time.Time
	dir := filepath.Join(dataDir, "schedules")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return latest
	}
	for _, ent := range entries {
		if ent.IsDir() || !strings.HasSuffix(strings.ToLower(ent.Name()), ".json") {
			continue
		}
		info, infoErr := ent.Info()
		if infoErr == nil && info.ModTime().After(latest) {
			latest = info.ModTime()
		}
	}
	return latest
}

// AggregatedScheduleMaxMtime combines schedules tree + events tree mtimes for /api/schedule cache.
func AggregatedScheduleMaxMtime(dataDir string) time.Time {
	latest := AllSchedulesMaxMtime(dataDir)
	if ev := EventsTreeMaxMtime(dataDir); ev.After(latest) {
		latest = ev
	}
	return latest
}
