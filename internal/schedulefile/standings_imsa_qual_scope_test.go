package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildImsaStandings_LMP204NoMonQualFromGTDPro4(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildImsaStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildImsaStandingsFromEvents: %v", err)
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
	var car04 *StandingRow
	for i := range lmp2.Rows {
		if lmp2.Rows[i].Car == "04" {
			car04 = &lmp2.Rows[i]
			break
		}
	}
	if car04 == nil {
		t.Fatal("LMP2 #04 missing")
	}
	if _, ok := car04.Quals["MON"]; ok {
		t.Errorf("LMP2 #04 should not have MON qual (sprint round, car not entered); quals=%v", car04.Quals)
	}
}

func TestBuildImsaStandings_GTP31MonRaceP2(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	data, err := BuildImsaStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("BuildImsaStandingsFromEvents: %v", err)
	}
	var gtp *StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "GTP" {
			gtp = &data.Classes[i]
			break
		}
	}
	if gtp == nil {
		t.Fatal("GTP class missing")
	}
	var car31 *StandingRow
	for i := range gtp.Rows {
		if gtp.Rows[i].Car == "31" {
			car31 = &gtp.Rows[i]
			break
		}
	}
	if car31 == nil {
		t.Fatal("GTP #31 missing")
	}
	if car31.Races["MON"] != "2" {
		t.Errorf("GTP #31 MON race = %q, want 2", car31.Races["MON"])
	}
}
