package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/vX8q/tga/models"
)

func TestCrownJewelMatch_Daytona500NotSummer400(t *testing.T) {
	j := CrownJewel{
		ID:        "daytona_500",
		SeriesIDs: []string{"NASCAR_CUP"},
		NameAny:   []string{"daytona 500"},
	}
	if !j.Match("NASCAR_CUP", "Daytona 500", "Daytona International Speedway") {
		t.Fatal("Daytona 500 should match")
	}
	if j.Match("NASCAR_CUP", "Coke Zero Sugar 400", "Daytona International Speedway") {
		t.Fatal("Coke Zero Sugar 400 must not match Daytona 500")
	}
	if j.Match("NOAPS", "Daytona 500", "Daytona International Speedway") {
		t.Fatal("wrong series must not match")
	}
}

func TestCrownJewelMatch_Indy500RunningPrefix(t *testing.T) {
	j := CrownJewel{
		ID:        "indy_500",
		SeriesIDs: []string{"INDYCAR"},
		NameAny:   []string{"indianapolis 500", "indy 500"},
	}
	if !j.Match("INDYCAR", "110th Running of the Indianapolis 500", "Indianapolis Motor Speedway") {
		t.Fatal("Indy 500 running title should match")
	}
}

func TestCrownJewelMatch_LeMansExcludesLoneStar(t *testing.T) {
	j := CrownJewel{
		ID:          "wec_le_mans",
		SeriesIDs:   []string{"WEC"},
		NameAny:     []string{"24 hours of le mans"},
		NameExclude: []string{"lone star"},
	}
	if !j.Match("WEC", "24 Hours of Le Mans", "Circuit de la Sarthe") {
		t.Fatal("Le Mans should match")
	}
	if j.Match("WEC", "Lone Star Le Mans", "Circuit of The Americas") {
		t.Fatal("Lone Star Le Mans must not match 24 Hours of Le Mans")
	}
}

func TestCrownJewelMatch_F1MonacoAfterYearStrip(t *testing.T) {
	j := CrownJewel{
		ID:        "f1_monaco",
		SeriesIDs: []string{"F1"},
		NameAny:   []string{"monaco grand prix"},
	}
	cleaned := cleanEventName("F1", "2026 Monaco Grand Prix")
	if cleaned != "Monaco Grand Prix" {
		t.Fatalf("cleanEventName = %q, want Monaco Grand Prix", cleaned)
	}
	if !j.Match("F1", cleaned, "Circuit de Monaco") {
		t.Fatal("cleaned Monaco GP should match")
	}
	if j.Match("F1", "Australian Grand Prix", "Albert Park") {
		t.Fatal("Australian GP must not match Monaco")
	}
}

func TestLoadCrownJewelsFile(t *testing.T) {
	resetCrownJewelsCacheForTest()
	dataDir := filepath.Join("..", "..", "data")
	jewels := LoadCrownJewels(dataDir)
	if len(jewels) < 10 {
		t.Fatalf("expected crown jewels catalog, got %d", len(jewels))
	}
	var sawDaytona, sawIndy, sawMonaco, sawLeMans bool
	for _, j := range jewels {
		switch j.ID {
		case "daytona_500":
			sawDaytona = true
		case "indy_500":
			sawIndy = true
		case "f1_monaco":
			sawMonaco = true
		case "wec_le_mans":
			sawLeMans = true
		}
	}
	if !sawDaytona || !sawIndy || !sawMonaco || !sawLeMans {
		t.Fatalf("missing core jewels: daytona=%v indy=%v monaco=%v lemans=%v", sawDaytona, sawIndy, sawMonaco, sawLeMans)
	}
}

func TestBuildDriverAchievements_ReddickDaytona500(t *testing.T) {
	resetCrownJewelsCacheForTest()
	dataDir := filepath.Join("..", "..", "data")
	results, err := BuildDriverSeasonResultsFromEvents(dataDir, "tyler-reddick", "2026")
	if err != nil {
		t.Fatalf("BuildDriverSeasonResultsFromEvents: %v", err)
	}
	achs := BuildDriverAchievements(dataDir, results)
	var found bool
	for _, a := range achs {
		if a.ID != "daytona_500" {
			continue
		}
		found = true
		if a.Count < 1 {
			t.Fatalf("daytona_500 count = %d", a.Count)
		}
		okYear := false
		for _, y := range a.Years {
			if y == "2026" {
				okYear = true
			}
		}
		if !okYear {
			t.Fatalf("expected 2026 in years, got %v", a.Years)
		}
	}
	if !found {
		t.Fatalf("expected Daytona 500 achievement for tyler-reddick, got %#v", achs)
	}
}

func TestBuildDriverTitles_NorrisAndVerstappen(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	norris := BuildDriverTitles(dataDir, "lando-norris")
	if len(norris) != 1 || norris[0].Count < 1 {
		t.Fatalf("lando-norris titles = %#v", norris)
	}
	if !strings.Contains(strings.Join(norris[0].Seasons, ","), "2025") {
		t.Fatalf("expected 2025 title for Norris, got %v", norris[0].Seasons)
	}
	verstappen := BuildDriverTitles(dataDir, "max-verstappen")
	if len(verstappen) != 1 || verstappen[0].Count < 4 {
		t.Fatalf("max-verstappen titles = %#v", verstappen)
	}
}

func TestBuildDriverTeamHistory_MergesConsecutiveYears(t *testing.T) {
	stints := BuildDriverTeamHistory([]models.DriverSeasonResult{
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Red Bull Racing-Honda RBPT", Season: "2024", EventID: "F1_2024_1", CarNumber: "1"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Oracle Red Bull Racing", Season: "2025", EventID: "F1_2025_1", CarNumber: "1"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Red Bull Racing-Red Bull Ford", Season: "2026", EventID: "F1_2026_1", CarNumber: "1"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Red Bull Racing-Red Bull Ford", Season: "2026", EventID: "F1_2026_2", RaceName: "Sprint", CarNumber: "1"},
	})
	if len(stints) != 1 {
		t.Fatalf("got %d stints, want 1: %#v", len(stints), stints)
	}
	s := stints[0]
	if s.TeamName != "Red Bull Racing" {
		t.Fatalf("team = %q", s.TeamName)
	}
	if s.YearsLabel != "2024–2026" || s.SeasonCount != 3 {
		t.Fatalf("range = %q count=%d", s.YearsLabel, s.SeasonCount)
	}
	if s.Starts != 4 {
		t.Fatalf("starts = %d, want 4", s.Starts)
	}
	if s.CarNumber != "1" {
		t.Fatalf("car = %q", s.CarNumber)
	}
}

func TestBuildDriverTeamHistory_F1CommercialAliases(t *testing.T) {
	stints := BuildDriverTeamHistory([]models.DriverSeasonResult{
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Mercedes-AMG Petronas F1 Team", Season: "2024", EventID: "e1", RaceName: "Entry list", Status: "Entry list"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Mercedes", Season: "2024", EventID: "e1", CarNumber: "44"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Scuderia Ferrari HP", Season: "2025", EventID: "e2"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Ferrari", Season: "2026", EventID: "e3"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Scuderia Ferrari HP", Season: "2026", EventID: "e3", RaceName: "Entry list", Status: "Entry list"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Haas-Ferrari", Season: "2026", EventID: "e4"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "McLaren-Mercedes", Season: "2026", EventID: "e5"},
	})
	if len(stints) != 4 {
		t.Fatalf("got %d stints, want 4: %#v", len(stints), stints)
	}
	byTeam := map[string]models.DriverTeamStint{}
	for _, s := range stints {
		byTeam[s.TeamName] = s
	}
	if s := byTeam["Ferrari"]; s.YearsLabel != "2025–2026" || s.Starts != 2 {
		t.Fatalf("Ferrari = %#v", s)
	}
	if s := byTeam["Mercedes"]; s.YearsLabel != "2024" || s.Starts != 1 {
		t.Fatalf("Mercedes = %#v", s)
	}
	if s := byTeam["Haas"]; s.YearsLabel != "2026" {
		t.Fatalf("Haas = %#v", s)
	}
	if s := byTeam["McLaren"]; s.YearsLabel != "2026" {
		t.Fatalf("McLaren = %#v", s)
	}
}

func TestBuildDriverTeamHistory_GapAndTeamChange(t *testing.T) {
	stints := BuildDriverTeamHistory([]models.DriverSeasonResult{
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "McLaren-Mercedes", Season: "2024", EventID: "a"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "Ferrari", Season: "2025", EventID: "b"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "McLaren", Season: "2026", EventID: "c"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "", Season: "2026", EventID: "d"},
		{SeriesID: "F1", SeriesName: "Formula 1", TeamName: "McLaren", Season: "2026", EventID: "e", Status: "Entry list", RaceName: "Entry list"},
	})
	if len(stints) != 3 {
		t.Fatalf("got %d stints, want 3: %#v", len(stints), stints)
	}
	if stints[0].TeamName != "McLaren" || stints[0].YearsLabel != "2026" || stints[0].Starts != 1 {
		t.Fatalf("newest McLaren = %#v", stints[0])
	}
	if stints[1].TeamName != "Ferrari" || stints[1].YearsLabel != "2025" {
		t.Fatalf("Ferrari = %#v", stints[1])
	}
	if stints[2].TeamName != "McLaren" || stints[2].YearsLabel != "2024" {
		t.Fatalf("early McLaren = %#v", stints[2])
	}
}

func TestBuildDriverTeamHistory_StockCarFoldAndSeriesSplit(t *testing.T) {
	stints := BuildDriverTeamHistory([]models.DriverSeasonResult{
		{SeriesID: "NASCAR_CUP", SeriesName: "NASCAR Cup Series", TeamName: "Hendrick Motorsports", Season: "2025", EventID: "c1"},
		{SeriesID: "NASCAR_CUP", SeriesName: "NASCAR Cup Series", TeamName: "Hendrick Motorsports", Season: "2026", EventID: "c2"},
		{SeriesID: "NOAPS", SeriesName: "NASCAR Xfinity Series", TeamName: "JR Motorsports", Season: "2026", EventID: "x1"},
	})
	if len(stints) != 2 {
		t.Fatalf("got %d stints, want 2: %#v", len(stints), stints)
	}
	var cup, xfinity *models.DriverTeamStint
	for i := range stints {
		switch stints[i].SeriesID {
		case "NASCAR_CUP":
			cup = &stints[i]
		case "NOAPS":
			xfinity = &stints[i]
		}
	}
	if cup == nil || cup.YearsLabel != "2025–2026" || cup.TeamName != "Hendrick Motorsports" {
		t.Fatalf("cup = %#v", cup)
	}
	if xfinity == nil || xfinity.YearsLabel != "2026" || xfinity.TeamName != "JR Motorsports" {
		t.Fatalf("xfinity = %#v", xfinity)
	}
}

func TestBuildDriverAchievements_TripleCrown(t *testing.T) {
	resetCrownJewelsCacheForTest()
	dataDir := filepath.Join("..", "..", "data")
	results := []models.DriverSeasonResult{
		{SeriesID: "F1", EventID: "F1_2024_8", EventName: "Monaco Grand Prix", Season: "2024", Position: 1},
		{SeriesID: "INDYCAR", EventID: "INDYCAR_2024_7", EventName: "Indianapolis 500", Season: "2024", Position: 1},
		{SeriesID: "WEC", EventID: "WEC_2024_3", EventName: "24 Hours of Le Mans", Season: "2024", Position: 1, ClassPosition: 1},
	}
	achs := BuildDriverAchievements(dataDir, results)
	if len(achs) == 0 || achs[0].ID != "triple_crown" {
		t.Fatalf("expected triple_crown first, got %#v", achs)
	}
}

func TestBuildDriverTeamHistory_HamiltonFerrariOneInterval(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	results, err := BuildDriverSeasonResultsFromEvents(dataDir, "lewis-hamilton", "")
	if err != nil {
		t.Fatalf("BuildDriverSeasonResultsFromEvents: %v", err)
	}
	stints := BuildDriverTeamHistory(results)
	var ferrari, mercedes *models.DriverTeamStint
	for i := range stints {
		switch stints[i].TeamName {
		case "Ferrari":
			ferrari = &stints[i]
		case "Mercedes":
			mercedes = &stints[i]
		}
	}
	if ferrari == nil || ferrari.YearsLabel != "2025–2026" {
		t.Fatalf("Ferrari stint = %#v, want 2025–2026", ferrari)
	}
	if ferrari.Starts < 1 {
		t.Fatalf("Ferrari starts = %d, want race starts from filled seasons", ferrari.Starts)
	}
	if mercedes == nil || mercedes.YearsLabel != "2024" {
		t.Fatalf("Mercedes stint = %#v, want 2024", mercedes)
	}
}
