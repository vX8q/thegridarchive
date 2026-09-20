package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestImsaMecPointsForClassPos(t *testing.T) {
	cases := []struct {
		pos  int
		want float64
	}{
		{1, 5},
		{2, 4},
		{3, 3},
		{4, 2},
		{10, 2},
		{0, 0},
	}
	for _, tc := range cases {
		got := imsaMecPointsForClassPos(tc.pos)
		if got != tc.want {
			t.Fatalf("pos %d: got %v want %v", tc.pos, got, tc.want)
		}
	}
}

func findImsaStandingsCar(t *testing.T, data *StandingsData, classID, car string) *StandingRow {
	t.Helper()
	for i := range data.Classes {
		if data.Classes[i].ID != classID {
			continue
		}
		for j := range data.Classes[i].Rows {
			if carNumbersMatch(data.Classes[i].Rows[j].Car, car) {
				return &data.Classes[i].Rows[j]
			}
		}
	}
	t.Fatalf("missing %s #%s", classID, car)
	return nil
}

func TestBuildImsaStandings_MecOfficialPdfTotals(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildImsaStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildImsaStandingsFromEvents: %v", err)
	}
	car7 := findImsaStandingsCar(t, data, "GTP", "7")
	if car7.RoundMecPoints["DAY24"] != "20" {
		t.Fatalf("GTP #7 Daytona MEC: got %q want 20", car7.RoundMecPoints["DAY24"])
	}
	if car7.RoundMecPoints["SEB12"] != "15" {
		t.Fatalf("GTP #7 Sebring MEC: got %q want 15", car7.RoundMecPoints["SEB12"])
	}
	if car7.RoundMecPoints["WG"] != "4" {
		t.Fatalf("GTP #7 WGI MEC: got %q want 4", car7.RoundMecPoints["WG"])
	}
	if car7.RoundMecPoints["RA"] != "7" {
		t.Fatalf("GTP #7 RA MEC: got %q want 7", car7.RoundMecPoints["RA"])
	}
	if car7.MecPoints != "46" {
		t.Fatalf("GTP #7 season MEC: got %q want 46", car7.MecPoints)
	}
	car10 := findImsaStandingsCar(t, data, "GTP", "10")
	if car10.RoundMecPoints["RA"] != "7" {
		t.Fatalf("GTP #10 RA MEC: got %q want 7", car10.RoundMecPoints["RA"])
	}
	if car10.MecPoints != "26" {
		t.Fatalf("GTP #10 season MEC: got %q want 26 (8+7+4+7)", car10.MecPoints)
	}
	// JDC: Daytona PDF #85 is the same crew as later #5.
	jdc := findImsaStandingsCar(t, data, "GTP", "5")
	if jdc.RoundMecPoints["DAY24"] != "8" || jdc.MecPoints != "25" {
		alt := findImsaStandingsCar(t, data, "GTP", "85")
		if alt.RoundMecPoints["DAY24"] != "8" || alt.MecPoints != "25" {
			t.Fatalf("GTP JDC MEC on #5 %#v pts %s; on #85 %#v pts %s; want DAY24=8 total=25",
				jdc.RoundMecPoints, jdc.MecPoints, alt.RoundMecPoints, alt.MecPoints)
		}
	}
}
