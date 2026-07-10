package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestStatsDTM_WinwardRacingTeamsChampionship(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "teams", "dtm.json"), &TeamsWithSpec{
		Teams: []TeamJSON{
			{Team: "Mercedes-AMG Team Mann-Filter", TeamsChampionship: "Winward Racing", Number: "48"},
			{Team: "Mercedes-AMG Team Ravenol", TeamsChampionship: "Winward Racing", Number: "80"},
		},
	})
	writeStatsTestEvent(t, dataDir, "DTM", "dtm_2026_1", map[string]EventTable{
		"race": {
			Sessions: []EventTableSession{
				{Title: "Race 1", Headers: []string{"Pos", "No", "Driver", "Team", "Manufacturer", "Laps", "Points"}, Rows: [][]string{
					{"1", "48", "Jules Gounon", "Mercedes-AMG Team Mann-Filter", "Mercedes-AMG", "10", "25"},
					{"2", "80", "Maro Engel", "Mercedes-AMG Team Ravenol", "Mercedes-AMG", "10", "18"},
				}},
			},
		},
	}, nil)

	got, err := buildDriverStatsFromJSON(dataDir, "DTM", "2026")
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Rows) != 2 {
		t.Fatalf("expected 2 driver rows, got %#v", got.Rows)
	}
	for _, row := range got.Rows {
		if row.Races == 0 {
			t.Fatalf("driver row has no races: %#v", row)
		}
	}
	var winward *TeamStatsRow
	for i := range got.Teams {
		if got.Teams[i].Team == "Winward Racing" {
			winward = &got.Teams[i]
			break
		}
	}
	if winward == nil {
		t.Fatalf("Winward Racing not found in team stats: %#v", got.Teams)
	}
	if winward.Races != 2 || winward.Wins != 1 || winward.Points != 43 {
		t.Fatalf("unexpected Winward Racing team stats: %#v", winward)
	}
	for _, team := range got.Teams {
		if team.Team == "Mercedes-AMG Team Mann-Filter" || team.Team == "Mercedes-AMG Team Ravenol" {
			t.Fatalf("operational team should merge into Winward Racing, got %#v", team)
		}
	}
}
func TestStatsDTM_WinwardRacingFromRepoData(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	got, err := buildDriverStatsFromJSON(dataDir, "DTM", "2026")
	if err != nil {
		t.Fatal(err)
	}
	var winward *TeamStatsRow
	for i := range got.Teams {
		if got.Teams[i].Team == "Winward Racing" {
			winward = &got.Teams[i]
			break
		}
	}
	if winward == nil {
		t.Fatalf("Winward Racing not found in team stats: %#v", got.Teams)
	}
	for _, team := range got.Teams {
		if team.Team == "Mercedes-AMG Team Mann-Filter" || team.Team == "Mercedes-AMG Team Ravenol" {
			t.Fatalf("operational Mercedes teams should merge into Winward Racing, got %#v", team)
		}
	}
}

func TestDTMTeamChampionshipCanonFromRepoData(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	canon := dtmTeamChampionshipCanonByFoldKey(dataDir, "DTM")
	if canon[foldStockCarTeamKey("Mercedes-AMG Team Mann-Filter")] != "Winward Racing" {
		t.Fatalf("Mann-Filter mapping: %#v", canon)
	}
	if canon[foldStockCarTeamKey("Mercedes-AMG Team Ravenol")] != "Winward Racing" {
		t.Fatalf("Ravenol mapping: %#v", canon)
	}
}
