package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadStandings_ELMS_LegacyFileIsEmptyStub(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	// data/standings/elms.json is legacy only; API builds from data/events/ELMS/.
	data, err := LoadStandings(dataDir, "ELMS")
	if err != nil {
		t.Fatalf("LoadStandings: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Classes) != 0 {
		t.Fatalf("legacy elms.json must not ship class tables (got %d)", len(data.Classes))
	}
	if len(data.Rows) != 0 {
		t.Fatalf("legacy elms.json must not ship rows (got %d)", len(data.Rows))
	}
}

func TestBuildStandingsFromEvents_ELMS_FallsBackToBaseClasses(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildElmsStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}
	if len(data.Rows) != 0 {
		t.Fatalf("ELMS should use class tables, not flat rows (got %d)", len(data.Rows))
	}
	if len(data.Classes) == 0 {
		t.Fatal("expected class tables from events")
	}
}

func TestBuildElmsStandingsFromEvents_RoundDriversPerEvent(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildElmsStandingsFromEvents: %v", err)
	}
	var lmp2 *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "LMP2" {
			lmp2 = &data.Classes[i]
			break
		}
	}
	if lmp2 == nil {
		t.Fatal("LMP2 class missing")
	}
	var car43 *StandingRow
	for i := range lmp2.Rows {
		if lmp2.Rows[i].Car == "43" {
			car43 = &lmp2.Rows[i]
			break
		}
	}
	if car43 == nil {
		t.Fatal("#43 LMP2 missing from standings")
	}
	if car43.RoundDrivers == nil {
		t.Fatal("#43 missing round_drivers")
	}
	if car43.RoundPoints == nil {
		t.Fatal("#43 missing round_points")
	}
	lec := car43.RoundDrivers["LEC"]
	if lec == "" || !stringsContainsAll(lec, "Smiechowski", "Dillmann", "Ghiotto") {
		t.Fatalf("LEC #43 drivers = %q, want Smiechowski/Dillmann/Ghiotto", lec)
	}
	if stringsContains(lec, "Yelloly") {
		t.Fatalf("LEC #43 should not include Yelloly: %q", lec)
	}
	bar := car43.RoundDrivers["BAR"]
	if bar == "" || !stringsContainsAll(bar, "Smiechowski", "Dillmann", "Yelloly") {
		t.Fatalf("BAR #43 drivers = %q", bar)
	}
	if car43.RoundPoints["BAR"] != "10" || car43.RoundPoints["LEC"] != "6" || car43.RoundPoints["IMO"] != "2" {
		t.Fatalf("#43 round_points = %#v", car43.RoundPoints)
	}
}

func TestElmsStandingsStatusLabel(t *testing.T) {
	tests := []struct {
		posRaw     string
		laps       int
		leaderLaps int
		gap        string
		interval   string
		wantLabel  string
		classified bool
	}{
		{"47", 126, 126, "-75 Laps", "", "DSQ", false},
		{"46", 103, 104, "9 Laps", "-94 Laps", "DSQ", false},
		{"41", 91, 112, "21 Laps", "11 Laps", "Ret", false},
		{"46", 0, 112, "135 Laps", "", "Ret", false},
		{"12", 111, 112, "1 Lap", "1 Lap", "", true},
		{"DSQ", 100, 112, "", "", "DSQ", false},
	}
	for _, tt := range tests {
		label, ok := elmsStandingsStatusLabel(tt.posRaw, tt.laps, tt.leaderLaps, tt.gap, tt.interval)
		if label != tt.wantLabel || ok != tt.classified {
			t.Errorf("elmsStandingsStatusLabel(%q,%d,%d,%q,%q) = (%q,%v), want (%q,%v)",
				tt.posRaw, tt.laps, tt.leaderLaps, tt.gap, tt.interval, label, ok, tt.wantLabel, tt.classified)
		}
	}
}

func TestBuildElmsStandingsFromEvents_RetAndDSQCells(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildElmsStandingsFromEvents: %v", err)
	}
	want := map[string]map[string]string{
		"LMP2|29":        {"LEC": "Ret"},
		"LMP2|10":        {"IMO": "DSQ"},
		"LMP2|9":         {"BAR": "Ret"},
		"LMP2 Pro/Am|27": {"BAR": "Ret"},
		"LMP2 Pro/Am|14": {"IMO": "Ret"},
		"LMP2 Pro/Am|47": {"BAR": "Ret"},
		"LMP3|11":        {"LEC": "DSQ"},
		"LMP3|68":        {"BAR": "Ret"},
		"LMGT3|33":       {"BAR": "Ret"},
		"LMGT3|62":       {"LEC": "Ret"},
		"LMGT3|86":       {"BAR": "Ret"},
		"LMGT3|23":       {"LEC": "Ret", "IMO": "Ret"},
		"LMGT3|51":       {"LEC": "DSQ"},
	}
	for _, cls := range data.Classes {
		for _, r := range cls.Rows {
			key := cls.ID + "|" + r.Car
			exp, ok := want[key]
			if !ok {
				continue
			}
			for code, w := range exp {
				if r.Races[code] != w {
					t.Errorf("%s #%s %s: got %q want %q", cls.ID, r.Car, code, r.Races[code], w)
				}
			}
		}
	}
}

func stringsContains(s, sub string) bool {
	return stringsContainsFold(s, sub)
}

func stringsContainsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		if !stringsContainsFold(s, sub) {
			return false
		}
	}
	return true
}

func stringsContainsFold(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}
