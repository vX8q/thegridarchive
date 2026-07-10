package schedulefile

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// SeriesDataMaxMtime returns the latest mod time among inputs that affect
// standings/stats rebuilds: schedule JSON, optional standings JSON, and event
// files for the series season folder.
func SeriesDataMaxMtime(dataDir, seriesID, season string) time.Time {
	season = standingsSeasonOrDefault(season)
	seriesKey := strings.ToLower(strings.TrimSpace(seriesID))

	var latest time.Time
	touch := func(path string) {
		fi, err := os.Stat(path)
		if err != nil {
			return
		}
		if fi.ModTime().After(latest) {
			latest = fi.ModTime()
		}
	}

	touch(eventsPath(dataDir, seriesKey))
	touch(standingsPath(dataDir, seriesKey))

	if folder, ok := eventSeriesFolderNames[seriesKey]; ok && strings.TrimSpace(season) != "" {
		dir := filepath.Join(dataDir, "events", folder, season)
		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(strings.ToLower(path), ".json") {
				return nil
			}
			info, infoErr := d.Info()
			if infoErr == nil && info.ModTime().After(latest) {
				latest = info.ModTime()
			}
			return nil
		})
	}
	return latest
}
