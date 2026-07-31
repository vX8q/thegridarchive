package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestDTMNorisringGroupQualPointsMainiDorr(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	detail, err := LoadEventDetail(dataDir, "DTM_2026_4")
	if err != nil {
		t.Fatal(err)
	}

	qualPts := func(raceIdx int) map[string]float64 {
		m := make(map[string]float64)
		for _, aw := range dtmQualifyingAwards(detail, raceIdx, nil) {
			m[aw.driver] += aw.points
		}
		return m
	}

	r1 := qualPts(1)
	if r1["Arjun Maini"] != 1 {
		t.Errorf("NOR qual R1 Maini = %v, want 1", r1["Arjun Maini"])
	}
	if r1["Ben Dorr"] != 0 {
		t.Errorf("NOR qual R1 Dorr = %v, want 0", r1["Ben Dorr"])
	}

	r2 := qualPts(2)
	if r2["Arjun Maini"] != 1 {
		t.Errorf("NOR qual R2 Maini = %v, want 1", r2["Arjun Maini"])
	}
	if r2["Ben Dorr"] != 0 {
		t.Errorf("NOR qual R2 Dorr = %v, want 0", r2["Ben Dorr"])
	}
}

func TestDTMInterleavedGroupGridNorisringRace2(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatal(err)
	}
	detail, err := LoadEventDetail(dataDir, "DTM_2026_4")
	if err != nil {
		t.Fatal(err)
	}
	qual := detail.Tables["qualifying"]
	var groupA, groupB []dtmQualCandidate
	for _, sess := range qual.Sessions {
		if dtmQualifyingRaceIndexFromTitle(sess.Title) != 2 {
			continue
		}
		switch dtmQualGroupLetter(sess.Title) {
		case "A":
			groupA = dtmQualDriversFromSession(sess)
		case "B":
			groupB = dtmQualDriversFromSession(sess)
		}
	}
	grid := dtmInterleavedGroupGrid(groupB, groupA)
	if len(grid) < 3 {
		t.Fatalf("grid len %d, want at least 3", len(grid))
	}
	want := []string{"Nicki Thiim", "Finn Wiebelhaus", "Arjun Maini"}
	for i, name := range want {
		if grid[i].driver != name {
			t.Errorf("grid P%d = %q, want %q", i+1, grid[i].driver, name)
		}
	}
}
