package schedulefile

import "testing"

func TestMergeDriverNames_DedupesDiacritics(t *testing.T) {
	// Folded forms must collapse to one entry; first spelling wins.
	got := mergeDriverNames("Jose Muller", "José Müller")
	if got != "Jose Muller" {
		t.Fatalf("got %q, want single ASCII-first driver", got)
	}
	got2 := mergeDriverNames("José Müller", "Jose Muller")
	if got2 != "José Müller" {
		t.Fatalf("got %q, want single first-seen driver", got2)
	}
}
