package schedulefile

import "testing"

func TestStockCarIneligibleDriver(t *testing.T) {
	eligible := map[string]bool{"40": false, "41": true}
	if got := stockCarIneligibleDriver("Justin Allgaier", "40", eligible); got != "Justin Allgaier (i)" {
		t.Fatalf("entry flag: got %q", got)
	}
	if got := stockCarIneligibleDriver("Ross Chastain", "41", eligible); got != "Ross Chastain" {
		t.Fatalf("eligible: got %q", got)
	}
	if got := stockCarIneligibleDriver("Kyle Larson (i)", "5", nil); got != "Kyle Larson (i)" {
		t.Fatalf("name suffix: got %q", got)
	}
}
