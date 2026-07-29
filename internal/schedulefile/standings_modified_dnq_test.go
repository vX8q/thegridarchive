package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestNascarModifiedDNQPoints_NSM2026(t *testing.T) {
	dataDir, _ := filepath.Abs("../../data")
	detail, err := LoadEventDetail(dataDir, "NASCAR_MODIFIED_2026_1")
	if err != nil || detail == nil {
		t.Fatalf("LoadEventDetail: %v", err)
	}
	pts := nascarModifiedDNQPoints(detail)
	want := map[string]int{
		"conner jones":   11,
		"norman newman":  10,
		"luke fleming":   9,
		"cory plummer":   8,
		"dave sapienza":  7,
	}
	for k, w := range want {
		if pts[k] != w {
			t.Errorf("DNQ pts[%q] = %d, want %d", k, pts[k], w)
		}
	}
}

// Drivers who failed to qualify still score, so their championship total is the
// race points plus the DNQ credit. Expectations are derived from the event files
// so the check survives new rounds being added to the season.
func TestBuildStandings_NascarModified_SapienzaPlummerFleming(t *testing.T) {
	dataDir, _ := filepath.Abs("../../data")
	events, err := LoadEvents(dataDir, "NASCAR_MODIFIED")
	if err != nil {
		t.Fatal(err)
	}
	racePoints := make(map[string]int)
	dnqPoints := make(map[string]int)
	for _, ev := range events {
		if ev.Season != "2026" {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		if rr, ok := detail.Tables["race_results"]; ok {
			addDriverPointsFromResultsTable("NASCAR_MODIFIED", rr, racePoints)
		}
		for driver, pts := range nascarModifiedDNQPoints(detail) {
			dnqPoints[driver] += pts
		}
	}

	data, err := BuildStandingsFromEvents(dataDir, "NASCAR_MODIFIED", "2026")
	if err != nil {
		t.Fatal(err)
	}
	byDriver := make(map[string]StandingRow)
	for _, r := range data.Rows {
		k := canonicalDriverKey(r.Driver)
		if k == "" {
			k = r.Driver
		}
		byDriver[k] = r
	}

	for _, key := range []string{"dave sapienza", "cory plummer", "luke fleming"} {
		r, ok := byDriver[key]
		if !ok {
			t.Fatalf("missing driver %q", key)
		}
		if dnqPoints[key] == 0 {
			t.Fatalf("%s has no DNQ points in the event files — pick another DNQ driver for this test", key)
		}
		want := itoa(racePoints[key] + dnqPoints[key])
		if r.Points != want {
			t.Errorf("%s points = %s, want %s (%d race + %d DNQ)", key, r.Points, want, racePoints[key], dnqPoints[key])
		}
		if r.Pos < 1 {
			t.Errorf("%s pos = %d, want a ranked position", key, r.Pos)
		}
	}
}
