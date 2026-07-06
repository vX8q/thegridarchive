package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestNascarModifiedDNQPoints_NSM2026(t *testing.T) {
	dataDir, _ := filepath.Abs("../../data")
	detail, err := LoadEventDetail(dataDir, "NASCAR_MODIFIED_2026_1")
	if err != nil || detail == nil {
		t.Fatalf("LoadEventDetail: %v", err)
	}
	pts := nascarModifiedDNQPoints(detail)
	want := map[string]int{
		"conner jones":   11,
		"norman newman":  10,
		"luke fleming":   9,
		"cory plummer":   8,
		"dave sapienza":  7,
	}
	for k, w := range want {
		if pts[k] != w {
			t.Errorf("DNQ pts[%q] = %d, want %d", k, pts[k], w)
		}
	}
}

func TestBuildStandings_NascarModified_SapienzaPlummerFleming(t *testing.T) {
	dataDir, _ := filepath.Abs("../../data")
	data, err := BuildStandingsFromEvents(dataDir, "NASCAR_MODIFIED", "2026")
	if err != nil {
		t.Fatal(err)
	}
	byDriver := make(map[string]StandingRow)
	for _, r := range data.Rows {
		k := canonicalDriverKey(r.Driver)
		if k == "" {
			k = r.Driver
		}
		byDriver[k] = r
	}
	cases := []struct {
		key  string
		pts  string
		pos  int
	}{
		{"dave sapienza", "96", 21},
		{"cory plummer", "91", 23},
		{"luke fleming", "32", 39},
	}
	for _, c := range cases {
		r, ok := byDriver[c.key]
		if !ok {
			t.Fatalf("missing driver %q", c.key)
		}
		if r.Points != c.pts {
			t.Errorf("%s points = %s, want %s", c.key, r.Points, c.pts)
		}
		if r.Pos != c.pos {
			t.Errorf("%s pos = %d, want %d", c.key, r.Pos, c.pos)
		}
	}
}
