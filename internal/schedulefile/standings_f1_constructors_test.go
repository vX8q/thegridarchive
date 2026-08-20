package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestBuildStandingsFromEvents_F1_2025_DriversAndConstructors(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	data, err := BuildStandingsFromEvents(dataDir, "F1", "2025")
	if err != nil {
		t.Fatalf("BuildStandingsFromEvents: %v", err)
	}
	if data == nil {
		t.Fatal("nil standings")
	}

	wantDrivers := map[string]string{
		"Lando Norris":     "423",
		"Max Verstappen":   "421",
		"Oscar Piastri":    "410",
		"George Russell":   "319",
		"Charles Leclerc":  "242",
		"Lewis Hamilton":   "156",
		"Kimi Antonelli":   "150",
		"Alexander Albon":  "73",
		"Carlos Sainz Jr.": "64",
		"Fernando Alonso":  "56",
		"Nico Hulkenberg":  "51",
		"Isack Hadjar":     "51",
		"Oliver Bearman":   "41",
		"Liam Lawson":      "38",
		"Esteban Ocon":     "38",
		"Lance Stroll":     "33",
		"Yuki Tsunoda":     "33",
		"Pierre Gasly":     "22",
		"Gabriel Bortoleto": "19",
		"Franco Colapinto": "0",
		"Jack Doohan":      "0",
	}
	gotDrivers := map[string]string{}
	for _, r := range data.Rows {
		gotDrivers[r.Driver] = r.Points
		if r.Team == "" {
			t.Errorf("driver %s: empty team/constructor", r.Driver)
		}
	}
	for name, pts := range wantDrivers {
		if gotDrivers[name] != pts {
			t.Errorf("driver %s: points=%s want %s", name, gotDrivers[name], pts)
		}
	}

	wantTeams := map[string]string{
		"McLaren-Mercedes":               "833",
		"Mercedes":                       "469",
		"Red Bull Racing-Honda RBPT":     "451",
		"Ferrari":                        "398",
		"Williams-Mercedes":              "137",
		"Racing Bulls-Honda RBPT":        "92",
		"Aston Martin Aramco-Mercedes":   "89",
		"Haas-Ferrari":                   "79",
		"Kick Sauber-Ferrari":            "70",
		"Alpine-Renault":                 "22",
	}
	if len(data.Teams) != len(wantTeams) {
		t.Fatalf("teams len=%d want %d", len(data.Teams), len(wantTeams))
	}
	for i, r := range data.Teams {
		if r.Pos != i+1 {
			t.Errorf("team %s pos=%d want %d", r.Driver, r.Pos, i+1)
		}
		want := wantTeams[r.Driver]
		if want == "" {
			t.Errorf("unexpected constructor %q", r.Driver)
			continue
		}
		if r.Points != want {
			t.Errorf("constructor %s: points=%s want %s", r.Driver, r.Points, want)
		}
	}
	if data.Teams[0].Driver != "McLaren-Mercedes" || data.Teams[0].Points != "833" {
		t.Errorf("P1 constructor=%s pts=%s", data.Teams[0].Driver, data.Teams[0].Points)
	}
}
