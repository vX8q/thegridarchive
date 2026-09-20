package main

import "testing"

func TestResolveTeamProfileSlug_AlpineCommercial(t *testing.T) {
	profiles := map[string]teamProfile{
		"alpine": {Kind: "organization", CanonicalName: "Alpine"},
	}
	redirects := map[string]string{
		"bwt-alpine-f1-team": "alpine",
		"alpine-mercedes":    "alpine",
	}
	got := resolveTeamProfileSlug("bwt-alpine-f1-team", profiles, redirects)
	if got != "alpine" {
		t.Fatalf("got %q, want alpine", got)
	}
	got = resolveTeamProfileSlug("alpine", profiles, redirects)
	if got != "alpine" {
		t.Fatalf("identity got %q", got)
	}
}

func TestResolveTeamProfileSlug_FerrariHP(t *testing.T) {
	profiles := map[string]teamProfile{
		"ferrari": {Kind: "organization", CanonicalName: "Ferrari"},
	}
	redirects := map[string]string{
		"scuderia-ferrari-hp": "ferrari",
	}
	got := resolveTeamProfileSlug("scuderia-ferrari-hp", profiles, redirects)
	if got != "ferrari" {
		t.Fatalf("got %q, want ferrari", got)
	}
}

func TestTeamDisplayNameForSeason(t *testing.T) {
	p := teamProfile{
		CanonicalName: "Alpine",
		DisplayNameBySeason: map[string]string{
			"f1|2023": "BWT Alpine F1 Team",
			"f1|2026": "BWT Alpine F1 Team",
		},
	}
	got := teamDisplayNameForSeason(p, "f1", "2023")
	if got != "BWT Alpine F1 Team" {
		t.Fatalf("got %q", got)
	}
	got = teamDisplayNameForSeason(p, "f1", "2099")
	if got != "BWT Alpine F1 Team" {
		t.Fatalf("fallback by series got %q", got)
	}
	got = teamDisplayNameForSeason(p, "wec", "2026")
	if got != "Alpine" {
		t.Fatalf("missing series should use canonical, got %q", got)
	}
}

func TestTeamSeriesRefs_LooseIDs(t *testing.T) {
	refs := teamSeriesRefs([]string{"nascar_cup", "noaps", ""})
	if len(refs) != 2 {
		t.Fatalf("len = %d, want 2", len(refs))
	}
	if refs[0].ID != "nascar_cup" || refs[0].Name != "NASCAR Cup Series" {
		t.Fatalf("cup ref = %+v", refs[0])
	}
	if refs[1].ID != "noaps" || refs[1].Name != "NASCAR O'Reilly Auto Parts Series" {
		t.Fatalf("noaps ref = %+v", refs[1])
	}
}

func TestAttachTeamOrgMetadata(t *testing.T) {
	resp := map[string]interface{}{}
	attachTeamOrgMetadata(resp, teamProfile{
		Founded:       "2025",
		Headquarters:  "Kannapolis, North Carolina, U.S.",
		Lineage:       "Stewart-Haas Racing → Haas Factory Team",
		Owner:         "Gene Haas",
		President:     "Joe Custer",
		TeamPrincipal: "  ",
	})
	if resp["founded"] != "2025" {
		t.Fatalf("founded = %v", resp["founded"])
	}
	if resp["headquarters"] != "Kannapolis, North Carolina, U.S." {
		t.Fatalf("hq = %v", resp["headquarters"])
	}
	if resp["lineage"] != "Stewart-Haas Racing → Haas Factory Team" {
		t.Fatalf("lineage = %v", resp["lineage"])
	}
	if resp["owner"] != "Gene Haas" {
		t.Fatalf("owner = %v", resp["owner"])
	}
	if resp["president"] != "Joe Custer" {
		t.Fatalf("president = %v", resp["president"])
	}
	if _, ok := resp["team_principal"]; ok {
		t.Fatal("empty team_principal should be omitted")
	}
	staff, ok := resp["staff"].([]teamStaffMember)
	if !ok || len(staff) != 2 {
		t.Fatalf("staff fallback = %#v", resp["staff"])
	}
	if staff[0].Name != "Gene Haas" || staff[0].Role != "Owner" || staff[0].Group != "management" {
		t.Fatalf("staff[0] = %+v", staff[0])
	}
	if staff[1].Name != "Joe Custer" || staff[1].Role != "President" {
		t.Fatalf("staff[1] = %+v", staff[1])
	}
}

func TestFilterTeamStaffBySeason(t *testing.T) {
	staff := []teamStaffMember{
		{Name: "Christian Horner", Role: "Team Principal", Group: "management", Seasons: []string{"2024"}},
		{Name: "Laurent Mekies", Role: "Team Principal", Group: "management", Seasons: []string{"2025", "2026"}},
		{Name: "Pierre Wache", Role: "Technical Director", Group: "technical", Seasons: []string{"2024", "2025", "2026"}},
		{Name: "Rick Hendrick", Role: "Owner", Group: "management"}, // all seasons
	}
	got := filterTeamStaffBySeason(staff, "2024")
	if len(got) != 3 {
		t.Fatalf("2024 len = %d, want 3: %#v", len(got), got)
	}
	if got[0].Name != "Christian Horner" || got[1].Name != "Pierre Wache" || got[2].Name != "Rick Hendrick" {
		t.Fatalf("2024 staff = %#v", got)
	}
	got26 := filterTeamStaffBySeason(staff, "2026")
	if len(got26) != 3 || got26[0].Name != "Laurent Mekies" {
		t.Fatalf("2026 staff = %#v", got26)
	}
}

func TestResolveTeamStaffPreservesSeasons(t *testing.T) {
	staff := resolveTeamStaff(teamProfile{
		Staff: []teamStaffMember{
			{Name: "Christian Horner", Role: "Team Principal", Group: "management", Seasons: []string{"2024"}},
		},
	})
	if len(staff) != 1 || len(staff[0].Seasons) != 1 || staff[0].Seasons[0] != "2024" {
		t.Fatalf("staff = %#v", staff)
	}
}

func TestResolveTeamStaffCuratedWins(t *testing.T) {
	staff := resolveTeamStaff(teamProfile{
		CanonicalName: "McLaren",
		Owner:         "McLaren Racing",
		TeamPrincipal: "Andrea Stella",
		Staff: []teamStaffMember{
			{Name: "Andrea Stella", Role: "Team Principal", Group: "management"},
			{Name: "Rob Marshall", Role: "Chief Designer", Group: "technical"},
		},
	})
	if len(staff) != 2 {
		t.Fatalf("len = %d, want curated only", len(staff))
	}
	if staff[1].Group != "technical" {
		t.Fatalf("group = %q", staff[1].Group)
	}
}

func TestResolveTeamStaffSkipsOwnerMatchingCanon(t *testing.T) {
	staff := resolveTeamStaff(teamProfile{
		CanonicalName: "McLaren Racing",
		Owner:         "McLaren Racing",
		TeamPrincipal: "Andrea Stella",
	})
	if len(staff) != 1 || staff[0].Name != "Andrea Stella" {
		t.Fatalf("staff = %#v", staff)
	}
}
