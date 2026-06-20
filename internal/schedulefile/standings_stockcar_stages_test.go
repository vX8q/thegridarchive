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
		for sn := 1; sn <= 2; sn++ {
			st, ok := StageN(detail.Tables, sn)
			if !ok {
				continue
			}
			sDriverCol := colIndex(st.Headers, "Driver")
			sPtsCol := colIndex(st.Headers, "Points")
			if sPtsCol < 0 {
				sPtsCol = colIndex(st.Headers, "Pts")
			}
			if sDriverCol < 0 || sPtsCol < 0 {
				t.Logf("%s stage%d: missing driver/points cols %v", ev.ID, sn, st.Headers)
				continue
			}
			for _, row := range st.Rows {
				if sDriverCol >= len(row) || sPtsCol >= len(row) {
					continue
				}
				d := strings.TrimSpace(row[sDriverCol])
				if d == "" {
					continue
				}
				pts := 0
				if s := strings.TrimSpace(row[sPtsCol]); s != "" {
					for _, c := range s {
						if c >= '0' && c <= '9' {
							pts = pts*10 + int(c-'0')
						}
					}
				}
				out[canonicalDriverKey(d)] += pts
			}
		}
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
	EnrichStagesFromEvents(dataDir, seriesID, data)
	apiStages := make(map[string]string)
	for _, row := range data.Rows {
		apiStages[row.Driver] = row.Stages
	}

	type diff struct {
		driver, build, api, events, tsv string
	}
	var diffs []diff
	seen := make(map[string]bool)
	for _, row := range data.Rows {
		k := canonicalDriverKey(row.Driver)
		seen[k] = true
		ev := fromEvents[k]
		tsv := fromTSV[k]
		b := buildStages[row.Driver]
		a := apiStages[row.Driver]
		if b != a || a != itoa(ev) || (tsv > 0 && ev != tsv) {
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
		if d.build != d.events || d.api != d.events {
			t.Errorf("%s stage points: build=%s api=%s want events=%s", d.driver, d.build, d.api, d.events)
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
