package eventscaffold

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/schedulefile"
)

func TestRun_createsMissingLastResultsEvent(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	schedDir := filepath.Join(dataDir, "schedules")
	if err := os.MkdirAll(schedDir, 0o750); err != nil {
		t.Fatal(err)
	}

	today := time.Now().Format("2006-01-02")
	end := today
	start := today

	sched := []byte(`[
		{
			"id": "TEST_SERIES_2026_1",
			"series_id": "TEST_SERIES",
			"season": "2026",
			"name": "Test Grand Prix",
			"location": "Test City, Test Country",
			"circuit_name": "Test Circuit, Test City, Test Country",
			"start_date": "` + start + `",
			"end_date": "` + end + `"
		}
	]`)
	if err := os.WriteFile(filepath.Join(schedDir, "test_series.json"), sched, 0o600); err != nil {
		t.Fatal(err)
	}

	n, err := Run(dataDir, Options{Mode: ModeLastResults, Season: "2026"})
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("created = %d, want 1", n)
	}

	outPath := schedulefile.PreferredEventDetailPath(dataDir, "TEST_SERIES_2026_1")
	if _, err := os.Stat(outPath); err != nil {
		t.Fatalf("expected file at %s: %v", outPath, err)
	}

	detail, err := schedulefile.LoadEventDetail(dataDir, "TEST_SERIES_2026_1")
	if err != nil {
		t.Fatal(err)
	}
	if detail.EventID != "TEST_SERIES_2026_1" {
		t.Fatalf("event_id = %q", detail.EventID)
	}
	if len(detail.Tables) == 0 {
		t.Fatal("expected tables")
	}
}

func TestRun_skipsExistingWithRaceResults(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	schedDir := filepath.Join(dataDir, "schedules")
	eventsDir := filepath.Join(dataDir, "events")
	if err := os.MkdirAll(schedDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(eventsDir, 0o750); err != nil {
		t.Fatal(err)
	}

	today := time.Now().Format("2006-01-02")
	sched := []byte(`[
		{
			"id": "TEST_SERIES_2026_2",
			"series_id": "TEST_SERIES",
			"season": "2026",
			"name": "Test Race 2",
			"start_date": "` + today + `",
			"end_date": "` + today + `"
		}
	]`)
	if err := os.WriteFile(filepath.Join(schedDir, "test_series.json"), sched, 0o600); err != nil {
		t.Fatal(err)
	}

	existing := &schedulefile.EventDetailJSON{
		EventID: "TEST_SERIES_2026_2",
		Tables: map[string]schedulefile.EventTable{
			"race_results": {Headers: []string{"Pos"}, Rows: [][]string{{"1"}}},
		},
	}
	if err := schedulefile.SaveEventDetailAtPreferredPath(dataDir, "TEST_SERIES_2026_2", existing); err != nil {
		t.Fatal(err)
	}

	n, err := Run(dataDir, Options{Mode: ModeLastResults, Season: "2026"})
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("created = %d, want 0", n)
	}
}

func TestRun_supercarsWeekendUsesBundlePathAndTitle(t *testing.T) {
	dataDir := "../../data"
	n, err := Run(dataDir, Options{
		Mode:     ModeMissing,
		Season:   "2026",
		EventIDs: []string{"SUPERCARS_2026_17"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("created = %d, want 0 (supercars_2026_6 already exists)", n)
	}

	detail, err := schedulefile.LoadEventDetail(dataDir, "SUPERCARS_2026_17")
	if err != nil {
		t.Fatal(err)
	}
	if detail.Race != "Darwin Triple Crown" {
		t.Fatalf("race = %q, want Darwin Triple Crown", detail.Race)
	}
	if detail.EventID != "SUPERCARS_2026_6" {
		t.Fatalf("event_id = %q, want SUPERCARS_2026_6", detail.EventID)
	}
}

func TestRaceTitle_stripsRaceSuffix(t *testing.T) {
	t.Parallel()
	if got := raceTitle("Darwin Triple Crown Race 1"); got != "Darwin Triple Crown" {
		t.Fatalf("got %q", got)
	}
	if got := raceTitle("Sydney 500"); got != "Sydney 500" {
		t.Fatalf("got %q", got)
	}
}
