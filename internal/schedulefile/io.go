package schedulefile

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// eventSeriesFolderNames maps series folder under data/events (season subfolders 2025, 2026, etc.).
// All championships from config: slug (data series id) → folder name for Series/Year layout.
var eventSeriesFolderNames = map[string]string{
	"f1": "F1", "f2": "F2", "f3": "F3", "frec": "FREC", "f4_it": "Italian F4", "smp_f4_ru": "SMP F4 Russia", "psc": "Porsche Supercup",
	"nascar_cup": "NASCAR Cup Series", "nascar_truck": "NASCAR Truck", "nascar_modified": "NASCAR Modified", "arca": "ARCA", "noaps": "NOAPS",
	"indycar": "IndyCar", "super_formula": "Super Formula",
	"supercars": "Supercars", "dtm": "DTM", "super_gt": "Super GT",
	"wec": "WEC", "elms": "ELMS", "imsa": "IMSA",
	"gtwce_end": "GT World Challenge Europe Endurance", "gtwce_sprint": "GT World Challenge Europe Sprint",
}

// saveJSONFile serializes a value to JSON and writes it to the given path.
func saveJSONFile(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o600)
}

// stripBOM removes a UTF-8 BOM prefix (EF BB BF) if present.
func stripBOM(b []byte) []byte {
	if len(b) >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF {
		return b[3:]
	}
	return b
}

// readFileIfExists reads a file and distinguishes missing file from other errors.
func readFileIfExists(path string) ([]byte, error) {
	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	return stripBOM(b), nil
}

// eventsPath returns the path to a series schedule file.
func eventsPath(dataDir, seriesID string) string {
	return filepath.Join(dataDir, "schedules", strings.ToLower(seriesID)+".json")
}

// standingsPath returns the path to a series standings file.
func standingsPath(dataDir, seriesID string) string {
	return filepath.Join(dataDir, "standings", strings.ToLower(seriesID)+".json")
}

// teamsPath returns the path to a series teams file.
func teamsPath(dataDir, seriesID string) string {
	return filepath.Join(dataDir, "teams", strings.ToLower(seriesID)+".json")
}

// eventDetailPath returns the path to an event detail file (flat directory).
func eventDetailPath(dataDir, eventID string) string {
	return filepath.Join(dataDir, "events", strings.ToLower(eventID)+".json")
}

var eventIDSeriesYearRe = regexp.MustCompile(`^([a-z0-9_]+)_(20\d{2})_`)

// eventDetailPathCandidates returns event JSON paths in lookup order:
// first data/events/{Series}/{Year}, then flat data/events.
func eventDetailPathCandidates(dataDir, eventID string) []string {
	idLower := strings.ToLower(eventID)
	flat := filepath.Join(dataDir, "events", idLower+".json")
	m := eventIDSeriesYearRe.FindStringSubmatch(idLower)
	if len(m) < 3 {
		return []string{flat}
	}
	series, year := m[1], m[2]
	folderName, ok := eventSeriesFolderNames[series]
	if !ok {
		return []string{flat}
	}
	subDir := filepath.Join(dataDir, "events", folderName, year, idLower+".json")
	return []string{subDir, flat}
}

// readEventDetailFile reads event JSON, checking data/events/{Series}/{Year} and the flat directory.
func readEventDetailFile(dataDir, eventID string) ([]byte, error) {
	return ReadEventDetailFile(dataDir, eventID)
}

// eventDetailFileIsPlaceholder is empty/minimal JSON that must not shadow a full file lower in the path list.
func eventDetailFileIsPlaceholder(b []byte) bool {
	t := bytes.TrimSpace(stripBOM(b))
	if len(t) == 0 {
		return true
	}
	return bytes.Equal(t, []byte("{}")) || bytes.Equal(t, []byte("null"))
}

// ReadEventDetailFile is the exported wrapper for HTTP handlers and other packages.
// Reads event JSON from data/events/{Series}/{Year} or flat data/events.
func ReadEventDetailFile(dataDir, eventID string) ([]byte, error) {
	resolvedID := ResolveEventDetailID(dataDir, eventID)
	for _, path := range eventDetailPathCandidates(dataDir, resolvedID) {
		b, err := os.ReadFile(path) //nolint:gosec
		if err == nil {
			b = stripBOM(b)
			if eventDetailFileIsPlaceholder(b) {
				continue
			}
			return b, nil
		}
		if !os.IsNotExist(err) {
			return nil, err
		}
	}
	return nil, os.ErrNotExist
}

// EventDetailExists returns true if event JSON exists in data/events/{Series}/{Year} or the flat directory.
func EventDetailExists(dataDir, eventID string) bool {
	resolvedID := ResolveEventDetailID(dataDir, eventID)
	for _, path := range eventDetailPathCandidates(dataDir, resolvedID) {
		b, err := os.ReadFile(path) //nolint:gosec
		if err == nil {
			if eventDetailFileIsPlaceholder(b) {
				continue
			}
			return true
		}
		if !os.IsNotExist(err) {
			return false
		}
	}
	return false
}

