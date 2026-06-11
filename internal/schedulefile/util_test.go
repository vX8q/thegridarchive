package schedulefile

import "testing"

func TestCollapseSpacedInitials(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"a j allmendinger", "aj allmendinger"},
		{"j j yeley", "jj yeley"},
		{"b j mcleod", "bj mcleod"},
		{"kyle larson", "kyle larson"},
		{"a j", "aj"},
		{"j j", "jj"},
	}
	for _, c := range cases {
		if got := collapseSpacedInitials(c.in); got != c.want {
			t.Errorf("collapseSpacedInitials(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCanonicalDriverKey_InitialVariants(t *testing.T) {
	pairs := [][2]string{
		{"AJ Allmendinger", "A. J. Allmendinger"},
		{"JJ Yeley", "J. J. Yeley"},
		{"BJ McLeod", "B. J. McLeod"},
	}
	for _, p := range pairs {
		a := canonicalDriverKey(p[0])
		b := canonicalDriverKey(p[1])
		if a == "" || a != b {
			t.Fatalf("canonicalDriverKey(%q)=%q vs canonicalDriverKey(%q)=%q", p[0], a, p[1], b)
		}
	}
}

func TestDriverCellMatchesSlug_Allmendinger(t *testing.T) {
	if !driverCellMatchesSlug("AJ Allmendinger", "a-j-allmendinger") {
		t.Fatal("AJ Allmendinger should match a-j-allmendinger")
	}
	if !driverCellMatchesSlug("A. J. Allmendinger", "aj-allmendinger") {
		t.Fatal("A. J. Allmendinger should match aj-allmendinger alias")
	}
}
