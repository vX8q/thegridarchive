package schedulefile

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func sumStagePointsCompletedCupOnly(t *testing.T) map[string]int {
	t.Helper()
	dataDir := filepath.Join("..", "..", "data")
	events, err := LoadEvents(dataDir, "NASCAR_CUP")
	if err != nil {
		t.Fatal(err)
	}
	base, _ := LoadStandings(dataDir, "NASCAR_CUP")
	raceOrder := []string{}
	if base != nil {
		raceOrder = base.RaceOrder
	}
	today := time.Now().Format(dateFormat)
	out := make(map[string]int)
	raceIdx := 0
	for _, ev := range events {
		if ev.Season != "2026" {
			continue
		}
		if isExhibitionEvent("NASCAR_CUP", ev.ID) {
			continue
		}
		if ev.StartDate != "" && ev.StartDate > today {
			continue
		}
		if raceIdx >= len(raceOrder) {
			break
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		rr, ok := detail.Tables["race_results"]
		if !ok || len(rr.Headers) == 0 || len(rr.Rows) == 0 {
			if st3, ok3 := detail.Tables["stage_3"]; ok3 && len(st3.Rows) > 0 {
				rr = st3
				ok = true
			}
		}
		if !ok || len(rr.Rows) == 0 {
			continue
		}
		raceIdx++
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
				continue
			}
			for _, row := range st.Rows {
				d := strings.TrimSpace(row[sDriverCol])
				pts := parseStagePtsCell(row, sPtsCol)
				out[canonicalDriverKey(d)] += pts
			}
		}
	}
	return out
}

func parseStagePtsCell(row []string, col int) int {
	if col < 0 || col >= len(row) {
		return 0
	}
	pts := 0
	for _, c := range strings.TrimSpace(row[col]) {
		if c >= '0' && c <= '9' {
			pts = pts*10 + int(c-'0')
		}
	}
	return pts
}

func TestNASCARCupEnrichUsesSameEventsAsBuild(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	if _, err := os.Stat(dataDir); err != nil {
		t.Skip("data dir missing")
	}
	completedOnly := sumStagePointsCompletedCupOnly(t)
	allEvents := sumStagePointsFromEvents(t, "NASCAR_CUP")

	data, err := BuildStandingsFromEvents(dataDir, "NASCAR_CUP", "2026")
	if err != nil {
		t.Fatal(err)
	}
	EnrichStagesFromEvents(dataDir, "NASCAR_CUP", data)

	var mismatches []string
	for _, row := range data.Rows {
		k := canonicalDriverKey(row.Driver)
		if row.Stages != itoa(completedOnly[k]) {
			mismatches = append(mismatches, row.Driver+": api="+row.Stages+" completed="+itoa(completedOnly[k])+" all="+itoa(allEvents[k]))
		}
	}
	if len(mismatches) > 0 {
		t.Fatalf("Cup enrich vs completed-only events:\n%s", strings.Join(mismatches, "\n"))
	}
	if completedOnly[canonicalDriverKey("Denny Hamlin")] != allEvents[canonicalDriverKey("Denny Hamlin")] {
		t.Logf("note: all-events (%d) != completed-only (%d) for Hamlin — enrich may include future races",
			allEvents[canonicalDriverKey("Denny Hamlin")],
			completedOnly[canonicalDriverKey("Denny Hamlin")])
	}
}
