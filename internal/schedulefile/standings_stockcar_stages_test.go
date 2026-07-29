package schedulefile

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func sumStagePointsFromEvents(t *testing.T, seriesID string) map[string]int {
	t.Helper()
	dataDir := filepath.Join("..", "..", "data")
	events, err := LoadEvents(dataDir, seriesID)
	if err != nil {
		t.Fatal(err)
	}
	out := make(map[string]int)
	for _, ev := range events {
		if isExhibitionEvent(seriesID, ev.ID) {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		accumulateStagePointsFromDetail(seriesID, detail, out)
	}
	return out
}

func stagesFromTSV(t *testing.T, refFile string) map[string]int {
	t.Helper()
	dataDir := filepath.Join("..", "..", "data")
	path := filepath.Join(dataDir, "reference", refFile)
	b, err := os.ReadFile(path)
	if err != nil {
		t.Skip("reference TSV missing: " + refFile)
	}
	ref := make(map[string]int)
	lines := strings.Split(string(b), "\n")
	for i, line := range lines {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue
		}
		rec := strings.Split(line, "\t")
		if len(rec) < 3 {
			continue
		}
		name := strings.TrimSpace(rec[0])
		if name == "" || strings.EqualFold(name, "driver") {
			continue
		}
		stRaw := strings.TrimSpace(rec[2])
		n := 0
		if stRaw != "" && stRaw != "—" && stRaw != "-" {
			for _, c := range stRaw {
				if c >= '0' && c <= '9' {
					n = n*10 + int(c-'0')
				}
			}
		}
		ref[canonicalDriverKey(name)] = n
	}
	return ref
}

func compareSeriesStagePoints(t *testing.T, seriesID, tsvFile string) {
	t.Helper()
	dataDir := filepath.Join("..", "..", "data")
	if _, err := os.Stat(dataDir); err != nil {
		t.Skip("data dir missing")
	}

	fromEvents := sumStagePointsFromEvents(t, seriesID)
	fromTSV := stagesFromTSV(t, tsvFile)

	data, err := BuildStandingsFromEvents(dataDir, seriesID, "2026")
	if err != nil || data == nil {
		t.Fatalf("build standings %s: %v", seriesID, err)
	}
	buildStages := make(map[string]string)
	for _, row := range data.Rows {
		buildStages[row.Driver] = row.Stages
	}
	EnrichStagesFromEvents(dataDir, seriesID, "2026", data)
	apiStages := make(map[string]string)
	for _, row := range data.Rows {
		apiStages[row.Driver] = row.Stages
	}

	type diff struct {
		driver, build, api, events, tsv string
	}
	var diffs []diff
	for _, row := range data.Rows {
		k := canonicalDriverKey(row.Driver)
		ev := fromEvents[k]
		tsv := fromTSV[k]
		b := buildStages[row.Driver]
		a := apiStages[row.Driver]
		if b != a || a != itoa(ev) {
			diffs = append(diffs, diff{row.Driver, b, a, itoa(ev), itoa(tsv)})
		}
	}
	sort.Slice(diffs, func(i, j int) bool { return diffs[i].driver < diffs[j].driver })

	if len(diffs) == 0 {
		t.Logf("%s: all %d eligible drivers match event-derived stage totals", seriesID, len(data.Rows))
		return
	}
	t.Logf("%s mismatches (driver | build | api | events-sum | tsv):", seriesID)
	for _, d := range diffs {
		t.Logf("  %s | %s | %s | %s | %s", d.driver, dashStage(d.build), dashStage(d.api), dashStage(d.events), dashStage(d.tsv))
	}
	for _, d := range diffs {
		// Stale NASCAR.com TSV is advisory only; require build/api == event-derived sum.
		if d.api != d.events {
			t.Errorf("%s stage points: api=%s want events=%s", d.driver, d.api, d.events)
		}
		if d.build != d.events {
			t.Errorf("%s stage points: build=%s want events=%s", d.driver, d.build, d.events)
		}
	}
}

func dashStage(s string) string {
	if strings.TrimSpace(s) == "" || s == "0" {
		return "—"
	}
	return s
}

func TestNASCARCupStagePointsMatchEvents(t *testing.T) {
	compareSeriesStagePoints(t, "NASCAR_CUP", "nascar_cup_2026_nascar_com.tsv")
}

func TestNASCARTruckStagePointsMatchEvents(t *testing.T) {
	compareSeriesStagePoints(t, "NASCAR_TRUCK", "nascar_truck_2026_nascar_com.tsv")
}

// Stage results land in the event file before the race classification does;
// that in-progress weekend must not blank out the Stage column.
func TestEnrichStagesFromEvents_CountsStagesBeforeRaceResults(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "noaps.json"), []EventJSON{
		{ID: "NOAPS_2026_1", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-14", EndDate: "2026-02-14"},
		{ID: "NOAPS_2026_2", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-21", EndDate: "2026-02-21"},
	})
	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_1.json"), &EventDetailJSON{
		Tables: map[string]EventTable{
			"stage_1":      {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Justin Allgaier", "10"}}},
			"stage_2":      {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Justin Allgaier", "8"}}},
			"race_results": {Headers: []string{"Pos", "Driver"}, Rows: [][]string{{"1", "Justin Allgaier"}}},
		},
	})
	// Weekend in progress: stages scored, race classification not published yet.
	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_2.json"), &EventDetailJSON{
		Tables: map[string]EventTable{
			"stage_1": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Justin Allgaier", "7"}}},
			"stage_2": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Justin Allgaier", "6"}}},
		},
	})

	data := &StandingsData{Rows: []StandingRow{{Driver: "Justin Allgaier", Stages: "18"}}}
	EnrichStagesFromEvents(dataDir, "NOAPS", "2026", data)
	if got := data.Rows[0].Stages; got != "31" {
		t.Fatalf("stage points = %q, want %q (18 scored + 13 from the weekend in progress)", got, "31")
	}
}

func TestAccumulateStagePointsIncludesCokeS3AndDuels(t *testing.T) {
	detail := &EventDetailJSON{
		Stage4Laps: "100",
		Tables: map[string]EventTable{
			"stage_1": {
				Headers: []string{"Driver", "Points"},
				Rows:    [][]string{{"Kyle Larson", "10"}, {"Denny Hamlin", "7"}},
			},
			"stage_2": {
				Headers: []string{"Driver", "Points"},
				Rows:    [][]string{{"Kyle Larson", "6"}, {"Denny Hamlin", "10"}},
			},
			"stage_3": {
				Headers: []string{"Driver", "Points"},
				Rows:    [][]string{{"Kyle Larson", "6"}, {"Denny Hamlin", "9"}},
			},
			"duel1": {
				Headers: []string{"Driver", "Points"},
				Rows:    [][]string{{"Kyle Larson", "8"}, {"Denny Hamlin", "1"}},
			},
		},
	}
	into := make(map[string]int)
	accumulateStagePointsFromDetail("NASCAR_CUP", detail, into)
	if got := into[canonicalDriverKey("Kyle Larson")]; got != 30 {
		t.Fatalf("Larson stages: got %d want 30 (10+6+6+8)", got)
	}
	if got := into[canonicalDriverKey("Denny Hamlin")]; got != 27 {
		t.Fatalf("Hamlin stages: got %d want 27 (7+10+9+1)", got)
	}

	// Ordinary 3-stage weekend: stage_3 must NOT count (no stage4_laps).
	ordinary := &EventDetailJSON{
		Tables: map[string]EventTable{
			"stage_1": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Kyle Larson", "5"}}},
			"stage_2": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Kyle Larson", "4"}}},
			"stage_3": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"Kyle Larson", "10"}}},
		},
	}
	into2 := make(map[string]int)
	accumulateStagePointsFromDetail("NASCAR_CUP", ordinary, into2)
	if got := into2[canonicalDriverKey("Kyle Larson")]; got != 9 {
		t.Fatalf("ordinary weekend: got %d want 9 (stage_3 excluded)", got)
	}

	// NOAPS/Truck: no duels, no stage_3 even if present.
	into3 := make(map[string]int)
	accumulateStagePointsFromDetail("NOAPS", detail, into3)
	if got := into3[canonicalDriverKey("Kyle Larson")]; got != 22 {
		t.Fatalf("NOAPS should count Coke-like S1+S2+S3 only when four-stage: got %d want 22", got)
	}
	into4 := make(map[string]int)
	noDuels := &EventDetailJSON{
		Tables: map[string]EventTable{
			"stage_1": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"A", "3"}}},
			"stage_2": {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"A", "2"}}},
			"duel1":   {Headers: []string{"Driver", "Points"}, Rows: [][]string{{"A", "9"}}},
		},
	}
	accumulateStagePointsFromDetail("NASCAR_TRUCK", noDuels, into4)
	if got := into4[canonicalDriverKey("A")]; got != 5 {
		t.Fatalf("Truck must ignore duel tables: got %d want 5", got)
	}
}
