package schedulefile

import (
	"fmt"
	"path/filepath"
	"testing"
)

func TestCompressRounds(t *testing.T) {
	cases := []struct {
		in   []int
		want string
	}{
		{[]int{}, ""},
		{[]int{1}, "1"},
		{[]int{1, 2, 3}, "1–3"},
		{[]int{1, 2, 3, 5}, "1–3, 5"},
		{[]int{3, 1, 2, 7, 8}, "1–3, 7–8"},
		{[]int{2, 4, 6}, "2, 4, 6"},
	}
	for _, c := range cases {
		set := map[int]bool{}
		for _, n := range c.in {
			set[n] = true
		}
		if got := compressRounds(set); got != c.want {
			t.Errorf("compressRounds(%v) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestEventRoundNumber(t *testing.T) {
	cases := []struct {
		id     string
		want   int
		wantOk bool
	}{
		{"NASCAR_CUP_2026_12", 12, true},
		{"NOAPS_2026_1", 1, true},
		{"NASCAR_CUP_2026_0", 0, false},
		{"nascar_cup_2026_allstar_race", 0, false},
	}
	for _, c := range cases {
		got, ok := eventRoundNumber(c.id)
		if got != c.want || ok != c.wantOk {
			t.Errorf("eventRoundNumber(%q) = (%d,%v), want (%d,%v)", c.id, got, ok, c.want, c.wantOk)
		}
	}
}

func TestEnrichTeamsRoundsFromEvents_FillsAndAppends(t *testing.T) {
	dataDir := t.TempDir()

	// Season schedule: 3 rounds.
	schedule := []EventJSON{
		{ID: "NOAPS_2026_1", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-01", EndDate: "2026-02-01"},
		{ID: "NOAPS_2026_2", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-08", EndDate: "2026-02-08"},
		{ID: "NOAPS_2026_3", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-15", EndDate: "2026-02-15"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "noaps.json"), schedule)

	// Curated teams: one full-time driver.
	teams := &TeamsWithSpec{
		Teams: []TeamJSON{
			{Number: "5", Driver: "Kyle Larson", Team: "Hendrick Motorsports", Manufacturer: "Chevrolet", FullTime: true},
		},
	}
	writeJSON(t, filepath.Join(dataDir, "teams", "noaps.json"), teams)

	mkEvent := func(rows []EntryListRow) *EventDetailJSON {
		return &EventDetailJSON{EntryList: rows}
	}
	larson := EntryListRow{Number: "5", Driver: "Kyle Larson", Team: "Hendrick Motorsports", Manufacturer: "Chevrolet"}
	oneOff := EntryListRow{Number: "99", Driver: "Jane OneOff", Team: "Spire Motorsports", Manufacturer: "Chevrolet", CrewChief: "Coach"}

	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_1.json"), mkEvent([]EntryListRow{larson, oneOff}))
	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_2.json"), mkEvent([]EntryListRow{larson}))
	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_3.json"), mkEvent([]EntryListRow{larson, oneOff}))

	data, err := LoadTeams(dataDir, "noaps")
	if err != nil {
		t.Fatalf("LoadTeams: %v", err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "noaps", "2026", data)

	if len(data.Teams) != 2 {
		t.Fatalf("expected 2 team rows after enrich, got %d", len(data.Teams))
	}
	// Existing row got rounds 1–3.
	if data.Teams[0].Driver != "Kyle Larson" || data.Teams[0].Rounds != "1–3" {
		t.Errorf("Larson row = %+v, want rounds 1–3", data.Teams[0])
	}
	// One-off driver appended as part-time with rounds "1, 3".
	app := data.Teams[1]
	if app.Driver != "Jane OneOff" || app.Number != "99" || app.Rounds != "1, 3" || app.FullTime {
		t.Errorf("appended row = %+v, want #99 Jane OneOff rounds '1, 3' part-time", app)
	}
	if app.CrewChief != "Coach" || app.Team != "Spire Motorsports" {
		t.Errorf("appended row missing entry-list fields: %+v", app)
	}
}

func TestEnrichTeamsRoundsFromEvents_GroupsSubstituteByCarNumber(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "nascar_cup.json"), []EventJSON{
		{ID: "NASCAR_CUP_2026_1", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-01", EndDate: "2026-02-01"},
		{ID: "NASCAR_CUP_2026_2", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-08", EndDate: "2026-02-08"},
		{ID: "NASCAR_CUP_2026_3", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-15", EndDate: "2026-02-15"},
	})
	// Curated teams (NASCAR Cup style): primary #33 — Jesse Love.
	teams := &TeamsWithSpec{Teams: []TeamJSON{
		{Number: "5", Driver: "Kyle Larson", Team: "Hendrick Motorsports", Manufacturer: "Chevrolet"},
		{Number: "33", Driver: "Jesse Love", Team: "Richard Childress Racing", Manufacturer: "Chevrolet", CrewChief: "Andy Street"},
	}}
	writeJSON(t, filepath.Join(dataDir, "teams", "nascar_cup.json"), teams)

	mk := func(rows ...EntryListRow) *EventDetailJSON { return &EventDetailJSON{EntryList: rows} }
	larson := EntryListRow{Number: "5", Driver: "Kyle Larson", Team: "Hendrick Motorsports", Manufacturer: "Chevrolet"}
	love := EntryListRow{Number: "33", Driver: "Jesse Love", Team: "Richard Childress Racing", Manufacturer: "Chevrolet", CrewChief: "Andy Street"}
	hill := EntryListRow{Number: "33", Driver: "Austin Hill", Team: "Richard Childress Racing", Manufacturer: "Chevrolet", CrewChief: "Andy Street"}
	hillI := EntryListRow{Number: "33", Driver: "Austin Hill (i)", Team: "Richard Childress Racing", Manufacturer: "Chevrolet", CrewChief: "Andy Street"}

	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_1.json"), mk(larson, love))
	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_2.json"), mk(larson, hill))
	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_3.json"), mk(larson, hillI))

	data, err := LoadTeams(dataDir, "nascar_cup")
	if err != nil {
		t.Fatalf("LoadTeams: %v", err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "nascar_cup", "2026", data)

	if len(data.Teams) != 3 {
		t.Fatalf("expected 3 rows (Larson, Love, Hill), got %d: %+v", len(data.Teams), data.Teams)
	}
	if data.Teams[1].Number != "33" || data.Teams[1].Driver != "Jesse Love" || data.Teams[1].Rounds != "1" {
		t.Errorf("row[1] = %+v, want #33 Jesse Love rounds 1", data.Teams[1])
	}
	// Substitute inserted right after primary on #33; "(i)" merged with normal name.
	sub := data.Teams[2]
	if sub.Number != "33" || sub.Driver != "Austin Hill" || sub.Rounds != "2–3" {
		t.Errorf("row[2] = %+v, want #33 Austin Hill rounds 2–3 grouped under car", sub)
	}
	if sub.Team != "Richard Childress Racing" || sub.CrewChief != "Andy Street" {
		t.Errorf("substitute inherited fields wrong: %+v", sub)
	}
}

func TestEnrichTeamsRoundsFromEvents_SubstituteForSingleDriverSeries(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "indycar.json"), []EventJSON{
		{ID: "INDYCAR_2026_1", SeriesID: "INDYCAR", Season: "2026", StartDate: "2026-03-01", EndDate: "2026-03-01"},
		{ID: "INDYCAR_2026_2", SeriesID: "INDYCAR", Season: "2026", StartDate: "2026-03-08", EndDate: "2026-03-08"},
	})
	teams := &TeamsWithSpec{Teams: []TeamJSON{
		{Number: "2", Driver: "Josef Newgarden", Team: "Team Penske", Manufacturer: "Chevrolet"},
	}}
	writeJSON(t, filepath.Join(dataDir, "teams", "indycar.json"), teams)
	mk := func(rows ...EntryListRow) *EventDetailJSON { return &EventDetailJSON{EntryList: rows} }
	reg := EntryListRow{Number: "2", Driver: "Josef Newgarden", Team: "Team Penske", Manufacturer: "Chevrolet"}
	sub := EntryListRow{Number: "2", Driver: "Reserve Driver", Team: "Team Penske", Manufacturer: "Chevrolet"}
	writeJSON(t, filepath.Join(dataDir, "events", "indycar_2026_1.json"), mk(reg))
	writeJSON(t, filepath.Join(dataDir, "events", "indycar_2026_2.json"), mk(sub))

	data, _ := LoadTeams(dataDir, "indycar")
	EnrichTeamsRoundsFromEvents(dataDir, "indycar", "2026", data)
	if len(data.Teams) != 2 {
		t.Fatalf("expected 2 rows, got %d: %+v", len(data.Teams), data.Teams)
	}
	if data.Teams[0].Driver != "Josef Newgarden" || data.Teams[0].Rounds != "1" {
		t.Errorf("row0 = %+v, want Newgarden rounds 1", data.Teams[0])
	}
	s := data.Teams[1]
	if s.Number != "2" || s.Driver != "Reserve Driver" || s.Rounds != "2" {
		t.Errorf("substitute = %+v, want #2 Reserve Driver rounds 2", s)
	}
	if s.Team != "Team Penske" || s.Manufacturer != "Chevrolet" {
		t.Errorf("substitute did not inherit car fields: %+v", s)
	}
}

func TestEnrichTeamsRoundsFromEvents_NewNumberGroupsUnderTeam(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "indycar.json"), []EventJSON{
		{ID: "INDYCAR_2026_1", SeriesID: "INDYCAR", Season: "2026", StartDate: "2026-03-01", EndDate: "2026-03-01"},
		{ID: "INDYCAR_2026_2", SeriesID: "INDYCAR", Season: "2026", StartDate: "2026-03-08", EndDate: "2026-03-08"},
	})
	teams := &TeamsWithSpec{Teams: []TeamJSON{
		{Number: "2", Driver: "Josef Newgarden", Team: "Team Penske", Manufacturer: "Chevrolet"},
		{Number: "10", Driver: "Alex Palou", Team: "Chip Ganassi Racing", Manufacturer: "Honda"},
	}}
	writeJSON(t, filepath.Join(dataDir, "teams", "indycar.json"), teams)
	mk := func(rows ...EntryListRow) *EventDetailJSON { return &EventDetailJSON{EntryList: rows} }
	newg := EntryListRow{Number: "2", Driver: "Josef Newgarden", Team: "Team Penske", Manufacturer: "Chevrolet"}
	palou := EntryListRow{Number: "10", Driver: "Alex Palou", Team: "Chip Ganassi Racing", Manufacturer: "Honda"}
	oneOff := EntryListRow{Number: "12", Driver: "Indy One-off", Team: "Team Penske", Manufacturer: "Chevrolet"}
	writeJSON(t, filepath.Join(dataDir, "events", "indycar_2026_1.json"), mk(newg, palou))
	writeJSON(t, filepath.Join(dataDir, "events", "indycar_2026_2.json"), mk(newg, palou, oneOff))

	data, _ := LoadTeams(dataDir, "indycar")
	EnrichTeamsRoundsFromEvents(dataDir, "indycar", "2026", data)
	if len(data.Teams) != 3 {
		t.Fatalf("expected 3 rows, got %d: %+v", len(data.Teams), data.Teams)
	}
	// New #12 should land in Team Penske block (after #2), not after Ganassi at end.
	if data.Teams[1].Number != "12" || data.Teams[1].Team != "Team Penske" {
		t.Errorf("row[1] = %+v, want new #12 grouped under Team Penske", data.Teams[1])
	}
	if data.Teams[2].Team != "Chip Ganassi Racing" {
		t.Errorf("row[2] = %+v, want Ganassi last", data.Teams[2])
	}
}

func TestEnrichTeamsRoundsFromEvents_BuildsGtFromEntryList(t *testing.T) {
	dataDir := t.TempDir()
	schedule := []EventJSON{
		{ID: "GTWCE_SPRINT_2026_1", SeriesID: "GTWCE_SPRINT", Season: "2026", StartDate: "2026-04-01", EndDate: "2026-04-01"},
		{ID: "GTWCE_SPRINT_2026_2", SeriesID: "GTWCE_SPRINT", Season: "2026", StartDate: "2026-04-08", EndDate: "2026-04-08"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "gtwce_sprint.json"), schedule)

	car2 := EntryListRow{Number: "2", Class: "PRO", Team: "Boutsen VDS", Car: "Porsche 911 GT3 R EVO", Driver1: "Dorian Boccolacci", Driver2: "Morris Schuring"}
	car10 := EntryListRow{Number: "10", Class: "GOLD", Team: "Boutsen VDS", Car: "Porsche", Driver1: "A One", Driver2: "B Two"}
	writeJSON(t, filepath.Join(dataDir, "events", "gtwce_sprint_2026_1.json"), &EventDetailJSON{EntryList: []EntryListRow{car10, car2}})
	writeJSON(t, filepath.Join(dataDir, "events", "gtwce_sprint_2026_2.json"), &EventDetailJSON{EntryList: []EntryListRow{car2}})

	data := &TeamsWithSpec{}
	EnrichTeamsRoundsFromEvents(dataDir, "gtwce_sprint", "2026", data)

	if len(data.Teams) != 2 {
		t.Fatalf("expected 2 built GT rows, got %d", len(data.Teams))
	}
	// PRO sorts before GOLD.
	r0 := data.Teams[0]
	if r0.Number != "2" || r0.Class != "PRO" || r0.Rounds != "1–2" {
		t.Errorf("row0 = %+v, want #2 PRO rounds 1–2", r0)
	}
	if len(r0.Drivers) != 2 || r0.Drivers[0] != "Dorian Boccolacci" || r0.Drivers[1] != "Morris Schuring" {
		t.Errorf("row0 drivers = %v, want two sprint drivers", r0.Drivers)
	}
	if data.Teams[1].Number != "10" || data.Teams[1].Rounds != "1" {
		t.Errorf("row1 = %+v, want #10 rounds 1", data.Teams[1])
	}
}

func TestEnrichTeamsRoundsFromEvents_BuildsFlatJuniorFromEntryList(t *testing.T) {
	dataDir := t.TempDir()
	schedule := []EventJSON{
		{ID: "F4_IT_2026_1", SeriesID: "F4_IT", Season: "2026", StartDate: "2026-04-01", EndDate: "2026-04-01"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "f4_it.json"), schedule)
	writeJSON(t, filepath.Join(dataDir, "events", "f4_it_2026_1.json"), &EventDetailJSON{EntryList: []EntryListRow{
		{Number: "1", Driver: "Christian Costoya", Team: "Prema Racing"},
	}})

	data := &TeamsWithSpec{}
	EnrichTeamsRoundsFromEvents(dataDir, "f4_it", "2026", data)
	if len(data.Teams) != 1 {
		t.Fatalf("expected 1 built junior row, got %d", len(data.Teams))
	}
	if data.Teams[0].Driver != "Christian Costoya" || data.Teams[0].Team != "Prema Racing" || data.Teams[0].Rounds != "1" {
		t.Errorf("row = %+v, want Costoya/Prema rounds 1", data.Teams[0])
	}
}

func TestEnrichTeamsRoundsFromEvents_FillsImsaByNumber(t *testing.T) {
	dataDir := t.TempDir()
	schedule := []EventJSON{
		{ID: "IMSA_2026_1", SeriesID: "IMSA", Season: "2026", StartDate: "2026-01-24", EndDate: "2026-01-25"},
		{ID: "IMSA_2026_2", SeriesID: "IMSA", Season: "2026", StartDate: "2026-03-14", EndDate: "2026-03-14"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "imsa.json"), schedule)
	// Curated IMSA row: multi-driver in Drivers, no single Driver.
	teams := &TeamsWithSpec{Teams: []TeamJSON{
		{Number: "6", Team: "Porsche Penske Motorsport", Class: "GTP", Chassis: "Porsche 963", Drivers: []string{"Matt Campbell", "Kévin Estre"}},
	}}
	writeJSON(t, filepath.Join(dataDir, "teams", "imsa.json"), teams)
	entry := EntryListRow{Number: "6", Driver: "Matt Campbell / Kévin Estre / Laurens Vanthoor", Team: "Porsche Penske Motorsport", Class: "GTP", Car: "Porsche 963"}
	writeJSON(t, filepath.Join(dataDir, "events", "imsa_2026_1.json"), &EventDetailJSON{EntryList: []EntryListRow{entry}})
	writeJSON(t, filepath.Join(dataDir, "events", "imsa_2026_2.json"), &EventDetailJSON{EntryList: []EntryListRow{entry}})

	data, _ := LoadTeams(dataDir, "imsa")
	EnrichTeamsRoundsFromEvents(dataDir, "imsa", "2026", data)
	if len(data.Teams) != 1 || data.Teams[0].Rounds != "1–2" {
		t.Errorf("expected IMSA #6 rounds 1–2, got %+v", data.Teams)
	}
}

func TestEnrichTeamsRoundsFromEvents_NoEntryListNoChange(t *testing.T) {
	dataDir := t.TempDir()
	schedule := []EventJSON{{ID: "NOAPS_2026_1", SeriesID: "NOAPS", Season: "2026", StartDate: "2026-02-01", EndDate: "2026-02-01"}}
	writeJSON(t, filepath.Join(dataDir, "schedules", "noaps.json"), schedule)
	writeJSON(t, filepath.Join(dataDir, "events", "noaps_2026_1.json"), &EventDetailJSON{})

	data := &TeamsWithSpec{Teams: []TeamJSON{{Number: "5", Driver: "Kyle Larson", Rounds: "All"}}}
	EnrichTeamsRoundsFromEvents(dataDir, "noaps", "2026", data)
	if len(data.Teams) != 1 || data.Teams[0].Rounds != "All" {
		t.Errorf("expected no change when no entry lists, got %+v", data.Teams)
	}
}

func TestDriverMatchKey_AllmendingerVariants(t *testing.T) {
	a := driverMatchKey("AJ Allmendinger")
	b := driverMatchKey("A. J. Allmendinger")
	if a == "" || a != b {
		t.Fatalf("driverMatchKey variants = %q vs %q", a, b)
	}
}

func TestStripDriverParenSuffix_TBA(t *testing.T) {
	if got := StripDriverParenSuffix("Max Zachem (TBA)"); got != "Max Zachem" {
		t.Fatalf("StripDriverParenSuffix = %q", got)
	}
	if got := StripDriverParenSuffix("TBA"); got != "TBA" {
		t.Fatalf("StripDriverParenSuffix(TBA) = %q", got)
	}
}

func TestDriverMatchKey_InitialVariants(t *testing.T) {
	pairs := [][2]string{
		{"JJ Yeley", "J. J. Yeley"},
		{"BJ McLeod", "B. J. McLeod"},
	}
	for _, p := range pairs {
		a := driverMatchKey(p[0])
		b := driverMatchKey(p[1])
		if a == "" || a != b {
			t.Fatalf("driverMatchKey(%q)=%q vs driverMatchKey(%q)=%q", p[0], a, p[1], b)
		}
	}
}

func TestEnrichTeamsRoundsFromEvents_MergesAllmendingerNameVariants(t *testing.T) {
	dataDir := t.TempDir()
	schedule := []EventJSON{
		{ID: "NASCAR_CUP_2026_1", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-01", EndDate: "2026-02-01"},
		{ID: "NASCAR_CUP_2026_2", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-08", EndDate: "2026-02-08"},
		{ID: "NASCAR_CUP_2026_3", SeriesID: "NASCAR_CUP", Season: "2026", StartDate: "2026-02-15", EndDate: "2026-02-15"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "nascar_cup.json"), schedule)
	writeJSON(t, filepath.Join(dataDir, "teams", "nascar_cup.json"), &TeamsWithSpec{
		Teams: []TeamJSON{{
			Number: "16", Driver: "A. J. Allmendinger", Team: "Kaulig Racing",
			Manufacturer: "Chevrolet", CrewChief: "Trent Owens", FullTime: true,
		}},
	})
	aj := EntryListRow{Number: "16", Driver: "AJ Allmendinger", Team: "Kaulig Racing", Manufacturer: "Chevrolet", CrewChief: "Trent Owens"}
	ajFull := EntryListRow{Number: "16", Driver: "A. J. Allmendinger", Team: "Kaulig Racing", Manufacturer: "Chevrolet", CrewChief: "Trent Owens"}
	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_1.json"), &EventDetailJSON{EntryList: []EntryListRow{ajFull}})
	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_2.json"), &EventDetailJSON{EntryList: []EntryListRow{aj}})
	writeJSON(t, filepath.Join(dataDir, "events", "nascar_cup_2026_3.json"), &EventDetailJSON{EntryList: []EntryListRow{ajFull}})

	data, err := LoadTeams(dataDir, "nascar_cup")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "nascar_cup", "2026", data)
	if len(data.Teams) != 1 {
		t.Fatalf("expected one Allmendinger row, got %d: %+v", len(data.Teams), data.Teams)
	}
	if data.Teams[0].Rounds != "1–3" {
		t.Fatalf("rounds = %q, want 1–3", data.Teams[0].Rounds)
	}
}

func TestEnrichTeamsRoundsFromEvents_F3ChampionshipOrdinal(t *testing.T) {
	dataDir := t.TempDir()
	// F3 2026: consecutive championship round IDs (Monaco = 2, Barcelona = 3, …).
	schedule := []EventJSON{
		{ID: "F3_2026_1", SeriesID: "F3", Season: "2026", StartDate: "2026-03-07", EndDate: "2026-03-08"},
		{ID: "F3_2026_2", SeriesID: "F3", Season: "2026", StartDate: "2026-06-06", EndDate: "2026-06-07"},
		{ID: "F3_2026_3", SeriesID: "F3", Season: "2026", StartDate: "2026-06-13", EndDate: "2026-06-14"},
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "f3.json"), schedule)
	writeJSON(t, filepath.Join(dataDir, "teams", "f3.json"), &TeamsWithSpec{
		Teams: []TeamJSON{{
			Number: "2", Driver: "Ugo Ugochukwu", Team: "Campos Racing", FullTime: true,
		}},
	})
	row := EntryListRow{Number: "2", Driver: "Ugo Ugochukwu", Team: "Campos Racing"}
	writeJSON(t, filepath.Join(dataDir, "events", "F3", "2026", "f3_2026_1.json"), &EventDetailJSON{EntryList: []EntryListRow{row}})
	writeJSON(t, filepath.Join(dataDir, "events", "F3", "2026", "f3_2026_2.json"), &EventDetailJSON{EntryList: []EntryListRow{row}})
	writeJSON(t, filepath.Join(dataDir, "events", "F3", "2026", "f3_2026_3.json"), &EventDetailJSON{EntryList: []EntryListRow{row}})

	data, err := LoadTeams(dataDir, "f3")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "f3", "2026", data)
	if len(data.Teams) != 1 {
		t.Fatalf("expected one row, got %d: %+v", len(data.Teams), data.Teams)
	}
	if data.Teams[0].Rounds != "1–3" {
		t.Fatalf("rounds = %q, want 1–3 (not 1, 3–4 from event ID suffix)", data.Teams[0].Rounds)
	}

	sets := eventRoundSets("f3", schedule, "2026")
	if got := sets["F3_2026_2"]; len(got) != 1 || got[0] != 2 {
		t.Fatalf("F3_2026_2 rounds = %v, want [2]", got)
	}
	if got := sets["F3_2026_3"]; len(got) != 1 || got[0] != 3 {
		t.Fatalf("F3_2026_3 rounds = %v, want [3]", got)
	}
}

func TestEntryDrivers_SplitsCrewStrings(t *testing.T) {
	got := entryDrivers(EntryListRow{
		Driver: "Griffin Peebles / Grégoire Saucy / Benjamin Hanley",
	})
	want := []string{"Griffin Peebles", "Grégoire Saucy", "Benjamin Hanley"}
	if len(got) != len(want) {
		t.Fatalf("slash crew: got %#v, want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("slash crew[%d] = %q, want %q", i, got[i], want[i])
		}
	}

	gotGT := entryDrivers(EntryListRow{Driver: "Sho Tsuboi; Kenta Yamashita"})
	if len(gotGT) != 2 || gotGT[0] != "Sho Tsuboi" || gotGT[1] != "Kenta Yamashita" {
		t.Fatalf("semicolon crew: got %#v", gotGT)
	}

	gotSlots := entryDrivers(EntryListRow{
		Driver1: "Jamie Chadwick",
		Driver2: "Valerio Rinicella",
		Driver3: "Ben Hanley",
	})
	if len(gotSlots) != 3 {
		t.Fatalf("driver1/2/3: got %#v", gotSlots)
	}

	gotSub := entryDrivers(EntryListRow{
		Driver:  "Brodie Kostecki",
		Driver2: "Todd Hazelwood",
	})
	if len(gotSub) != 2 || gotSub[0] != "Brodie Kostecki" || gotSub[1] != "Todd Hazelwood" {
		t.Fatalf("driver+driver2 substitute: got %#v", gotSub)
	}
}

func TestEnrichTeamsRoundsFromEvents_SupercarsDropsUnenteredWildcard(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "supercars.json"), []EventJSON{
		{ID: "SUPERCARS_2026_1", SeriesID: "SUPERCARS", Season: "2026", StartDate: "2026-02-20"},
	})
	writeJSON(t, filepath.Join(dataDir, "teams", "supercars.json"), &TeamsWithSpec{
		Teams: []TeamJSON{
			{Manufacturer: "Chevrolet", Team: "Team 18", Number: "15", Driver: "Craig Lowndes", FullTime: false},
			{Manufacturer: "Chevrolet", Team: "Team 18", Number: "18", Driver: "Anton de Pasquale", Rounds: "1", FullTime: true},
		},
	})
	writeJSON(t, filepath.Join(dataDir, "events", "Supercars", "2026", "supercars_2026_1.json"), &EventDetailJSON{
		EntryList: []EntryListRow{{Number: "18", Driver: "Anton de Pasquale", Team: "Team 18", Manufacturer: "Chevrolet"}},
	})

	data, err := LoadTeams(dataDir, "supercars")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "supercars", "2026", data)
	for _, row := range data.Teams {
		if row.Driver == "Craig Lowndes" {
			t.Fatalf("unentered wildcard should be dropped, still have Craig Lowndes")
		}
	}
	found := false
	for _, row := range data.Teams {
		if row.Driver == "Anton de Pasquale" {
			found = true
			if row.Rounds != "1" {
				t.Fatalf("Anton rounds = %q, want 1", row.Rounds)
			}
		}
	}
	if !found {
		t.Fatal("expected Anton de Pasquale row")
	}
}

func TestEnrichTeamsRoundsFromEvents_SupercarsMergesAlternateCarNumber(t *testing.T) {
	dataDir := t.TempDir()
	writeJSON(t, filepath.Join(dataDir, "schedules", "supercars.json"), []EventJSON{
		{ID: "SUPERCARS_2026_1", SeriesID: "SUPERCARS", Season: "2026", StartDate: "2026-02-20", CircuitName: "Sydney"},
		{ID: "SUPERCARS_2026_2", SeriesID: "SUPERCARS", Season: "2026", StartDate: "2026-03-01", CircuitName: "Melbourne"},
		{ID: "SUPERCARS_2026_3", SeriesID: "SUPERCARS", Season: "2026", StartDate: "2026-03-15", CircuitName: "Taupo"},
		{ID: "SUPERCARS_2026_4", SeriesID: "SUPERCARS", Season: "2026", StartDate: "2026-04-17", CircuitName: "Christchurch"},
	})
	writeJSON(t, filepath.Join(dataDir, "teams", "supercars.json"), &TeamsWithSpec{
		Teams: []TeamJSON{
			{Manufacturer: "Chevrolet", Team: "Team 18", Number: "20", Driver: "David Reynolds", Rounds: "1", FullTime: true},
		},
	})
	writeJSON(t, filepath.Join(dataDir, "events", "Supercars", "2026", "supercars_2026_1.json"), &EventDetailJSON{
		EntryList: []EntryListRow{{Number: "20", Driver: "David Reynolds", Team: "Team 18", Manufacturer: "Chevrolet"}},
	})
	writeJSON(t, filepath.Join(dataDir, "events", "Supercars", "2026", "supercars_2026_4.json"), &EventDetailJSON{
		EntryList: []EntryListRow{{Number: "500", Driver: "David Reynolds", Team: "Team 18", Manufacturer: "Chevrolet"}},
	})

	data, err := LoadTeams(dataDir, "supercars")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "supercars", "2026", data)
	for _, row := range data.Teams {
		if row.Number == "500" {
			t.Fatalf("alternate livery number should not create a teams row, still have #500")
		}
	}
	var reynolds *TeamJSON
	for i := range data.Teams {
		if data.Teams[i].Driver == "David Reynolds" {
			reynolds = &data.Teams[i]
			break
		}
	}
	if reynolds == nil {
		t.Fatal("expected David Reynolds row")
	}
	if reynolds.Rounds != "1, 4" {
		t.Fatalf("David Reynolds rounds = %q, want 1, 4", reynolds.Rounds)
	}
}

func TestEnrichTeamsRoundsFromEvents_SupercarsWeekendSubstitutes(t *testing.T) {
	dataDir := t.TempDir()
	sched := make([]EventJSON, 6)
	for i := 0; i < 6; i++ {
		sched[i] = EventJSON{
			ID:       fmt.Sprintf("SUPERCARS_2026_%d", i+1),
			SeriesID: "SUPERCARS",
			Season:   "2026",
		}
	}
	writeJSON(t, filepath.Join(dataDir, "schedules", "supercars.json"), sched)
	writeJSON(t, filepath.Join(dataDir, "teams", "supercars.json"), &TeamsWithSpec{
		Teams: []TeamJSON{
			{Manufacturer: "Ford", Team: "Dick Johnson Racing", Number: "17", Driver: "Brodie Kostecki", Rounds: "1", FullTime: true},
			{Manufacturer: "Ford", Team: "Tickford Racing", Number: "55", Driver: "Thomas Randle", Rounds: "1", FullTime: true},
		},
	})
	mk := func(drv, drv2 string) *EventDetailJSON {
		row := EntryListRow{Number: "17", Driver: drv, Team: "Dick Johnson Racing", Manufacturer: "Ford"}
		if drv2 != "" {
			row.Driver2 = drv2
		}
		return &EventDetailJSON{EntryList: []EntryListRow{row}}
	}
	for i := 1; i <= 5; i++ {
		writeJSON(t, filepath.Join(dataDir, "events", "Supercars", "2026", fmt.Sprintf("supercars_2026_%d.json", i)),
			mk("Brodie Kostecki", ""))
	}
	writeJSON(t, filepath.Join(dataDir, "events", "Supercars", "2026", "supercars_2026_6.json"),
		mk("Brodie Kostecki", "Todd Hazelwood"))

	data, err := LoadTeams(dataDir, "supercars")
	if err != nil {
		t.Fatal(err)
	}
	EnrichTeamsRoundsFromEvents(dataDir, "supercars", "2026", data)

	var kostecki, hazelwood *TeamJSON
	for i := range data.Teams {
		switch data.Teams[i].Driver {
		case "Brodie Kostecki":
			kostecki = &data.Teams[i]
		case "Todd Hazelwood":
			hazelwood = &data.Teams[i]
		}
	}
	if kostecki == nil {
		t.Fatal("expected Brodie Kostecki row")
	}
	if kostecki.Rounds != "1–6" {
		t.Fatalf("Kostecki rounds = %q, want 1–6", kostecki.Rounds)
	}
	if hazelwood == nil {
		t.Fatal("expected Todd Hazelwood substitute row")
	}
	if hazelwood.Number != "17" {
		t.Fatalf("Hazelwood number = %q, want 17", hazelwood.Number)
	}
	if hazelwood.Rounds != "6" {
		t.Fatalf("Hazelwood rounds = %q, want 6", hazelwood.Rounds)
	}
	if hazelwood.FullTime {
		t.Fatal("substitute should be part-time")
	}
}
