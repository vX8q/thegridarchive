package main

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const bootstrapStampFile = ".bootstrap_stamp"

// bootstrapModeFromEnv returns full | skip | incremental (default full).
func bootstrapModeFromEnv() string {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("TGA_BOOTSTRAP")))
	switch v {
	case "skip", "incremental", "full":
		return v
	default:
		return "full"
	}
}

func bootstrapStampPath(dataDir string) string {
	return filepath.Join(dataDir, bootstrapStampFile)
}

func readBootstrapStamp(dataDir string) (time.Time, bool) {
	b, err := os.ReadFile(bootstrapStampPath(dataDir))
	if err != nil {
		return time.Time{}, false
	}
	sec, err := strconv.ParseInt(strings.TrimSpace(string(b)), 10, 64)
	if err != nil || sec <= 0 {
		return time.Time{}, false
	}
	return time.Unix(sec, 0), true
}

func writeBootstrapStamp(dataDir string, t time.Time) error {
	if dataDir == "" {
		return nil
	}
	return os.WriteFile(bootstrapStampPath(dataDir), []byte(strconv.FormatInt(t.Unix(), 10)+"\n"), 0o600)
}

// dataJSONNewerThan is true when any *.json under schedules/ or events/ is newer than since.
func dataJSONNewerThan(dataDir string, since time.Time) bool {
	if dataDir == "" || since.IsZero() {
		return true
	}
	for _, sub := range []string{"schedules", "events"} {
		if jsonTreeNewerThan(filepath.Join(dataDir, sub), since) {
			return true
		}
	}
	return false
}

func jsonTreeNewerThan(root string, since time.Time) bool {
	newer := false
	_ = filepath.Walk(root, func(_ string, info os.FileInfo, err error) error {
		if err != nil || info == nil || info.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(info.Name()), ".json") {
			return nil
		}
		if info.ModTime().After(since) {
			newer = true
			return filepath.SkipAll
		}
		return nil
	})
	return newer
}
