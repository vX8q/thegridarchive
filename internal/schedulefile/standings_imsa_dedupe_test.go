package schedulefile

import "testing"

func TestMergeDriverNames_DedupesDiacritics(t *testing.T) {
	got := mergeDriverNames("José Müller", "Jose Muller")
	if got != "José Müller" {
		t.Fatalf("got %q, want single canonical driver", got)
	}
}
