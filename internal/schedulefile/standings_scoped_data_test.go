package schedulefile

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// standingsDataDirUpToRound mirrors data/ into a temp dir but keeps only the
// events of seriesFolder/season whose round is <= maxRound. Official championship
// totals are point-in-time values, so a test that asserts them must not see the
// rounds that were added to data/ after the snapshot was taken.
func standingsDataDirUpToRound(t *testing.T, seriesFolder, season string, maxRound int) string {
	t.Helper()
	src, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	dst := t.TempDir()

	rootEntries, err := os.ReadDir(src)
	if err != nil {
		t.Fatalf("read data dir: %v", err)
	}
	for _, e := range rootEntries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		copyTestFile(t, filepath.Join(src, e.Name()), filepath.Join(dst, e.Name()))
	}
	for _, dir := range []string{"schedules", "standings", "teams", "reference"} {
		copyTestDir(t, filepath.Join(src, dir), filepath.Join(dst, dir))
	}

	srcEvents := filepath.Join(src, "events", seriesFolder, season)
	eventEntries, err := os.ReadDir(srcEvents)
	if err != nil {
		t.Fatalf("read events dir %s: %v", srcEvents, err)
	}
	dstEvents := filepath.Join(dst, "events", seriesFolder, season)
	if err := os.MkdirAll(dstEvents, 0o755); err != nil {
		t.Fatalf("mkdir events: %v", err)
	}
	kept := 0
	for _, e := range eventEntries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		if round, ok := eventFileRound(e.Name()); ok && round > maxRound {
			continue
		}
		copyTestFile(t, filepath.Join(srcEvents, e.Name()), filepath.Join(dstEvents, e.Name()))
		kept++
	}
	if kept == 0 {
		t.Fatalf("no %s/%s events up to round %d", seriesFolder, season, maxRound)
	}
	return dst
}

// eventFileRound reads the trailing round number of an event file name.
// Files without one (prologue, pre-season tests) report ok=false and are always kept.
func eventFileRound(name string) (int, bool) {
	stem := strings.TrimSuffix(name, ".json")
	idx := strings.LastIndex(stem, "_")
	if idx < 0 {
		return 0, false
	}
	round, err := strconv.Atoi(stem[idx+1:])
	if err != nil {
		return 0, false
	}
	return round, true
}

func copyTestDir(t *testing.T, src, dst string) {
	t.Helper()
	entries, err := os.ReadDir(src)
	if os.IsNotExist(err) {
		return
	}
	if err != nil {
		t.Fatalf("read dir %s: %v", src, err)
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", dst, err)
	}
	for _, e := range entries {
		if e.IsDir() {
			copyTestDir(t, filepath.Join(src, e.Name()), filepath.Join(dst, e.Name()))
			continue
		}
		copyTestFile(t, filepath.Join(src, e.Name()), filepath.Join(dst, e.Name()))
	}
}

func copyTestFile(t *testing.T, src, dst string) {
	t.Helper()
	blob, err := os.ReadFile(src)
	if err != nil {
		t.Fatalf("read %s: %v", src, err)
	}
	if err := os.WriteFile(dst, blob, 0o600); err != nil {
		t.Fatalf("write %s: %v", dst, err)
	}
}

func TestEventFileRound(t *testing.T) {
	cases := map[string]struct {
		round int
		ok    bool
	}{
		"f2_2026_12.json":                {12, true},
		"nascar_cup_2026_0.json":         {0, true},
		"elms_2026_prologue.json":        {0, false},
		"f1_2026_pre_season_test_2.json": {2, true},
		"gtwce_end_2026_3.json":          {3, true},
	}
	for name, want := range cases {
		round, ok := eventFileRound(name)
		if ok != want.ok || (ok && round != want.round) {
			t.Errorf("eventFileRound(%q) = %d,%v want %d,%v", name, round, ok, want.round, want.ok)
		}
	}
}
