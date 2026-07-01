package schedulefile

import "testing"

func TestFoldStockCarTeamKey(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"SS-Green Light Racing", "ssgreenlightracing"},
		{"SS GreenLight Racing", "ssgreenlightracing"},
		{"Barrett Cope Racing", "barrettcoperacing"},
		{"Barrett-Cope Racing", "barrettcoperacing"},
		{"Barrett–Cope Racing", "barrettcoperacing"},
		{"JR Motorsports", "jrmotorsports"},
		{"", ""},
		{"—", ""},
	}
	for _, c := range cases {
		got := foldStockCarTeamKey(c.in)
		if got != c.want {
			t.Errorf("foldStockCarTeamKey(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCanonicalStockCarTeamName(t *testing.T) {
	byKey := map[string]string{
		"ssgreenlightracing": "SS-Green Light Racing",
		"barrettcoperacing":  "Barrett–Cope Racing",
	}
	if got := canonicalStockCarTeamName("SS GreenLight Racing", byKey); got != "SS-Green Light Racing" {
		t.Fatalf("got %q", got)
	}
	if got := canonicalStockCarTeamName("Barrett Cope Racing", byKey); got != "Barrett–Cope Racing" {
		t.Fatalf("got %q", got)
	}
}
