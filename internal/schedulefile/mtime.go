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

// TeamsDataMaxMtime is SeriesDataMaxMtime plus teams JSON files used by /teams
// (base series file and optional series_season file, e.g. f1_2024.json).
func TeamsDataMaxMtime(dataDir, seriesID, season string) time.Time {
	latest := SeriesDataMaxMtime(dataDir, seriesID, season)
	seriesKey := strings.ToLower(strings.TrimSpace(seriesID))
	season = standingsSeasonOrDefault(season)

	touch := func(path string) {
		fi, err := os.Stat(path)
		if err != nil {
			return
		}
		if fi.ModTime().After(latest) {
			latest = fi.ModTime()
		}
	}
	touch(teamsPath(dataDir, seriesKey))
	if season != "" {
		touch(teamsPath(dataDir, seriesKey+"_"+season))
	}
	return latest
}

// AllSeriesTeamsMaxMtime is the latest mod time that can change GET /api/teams:
// the event JSON tree plus data/teams/*.json.
func AllSeriesTeamsMaxMtime(dataDir string) time.Time {
	latest := EventsTreeMaxMtime(dataDir)
	teamsDir := filepath.Join(dataDir, "teams")
	entries, err := os.ReadDir(teamsDir)
	if err != nil {
		return latest
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".json") {
			continue
		}
		info, infoErr := e.Info()
		if infoErr == nil && info.ModTime().After(latest) {
			latest = info.ModTime()
		}
	}
	return latest
}
