package schedulefile

import (
	"path/filepath"
	"testing"
)

func TestResolveEventDetailID_SupercarsWeekend(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	cases := []struct {
		scheduleID string
		wantFile   string
	}{
		{"SUPERCARS_2026_1", "supercars_2026_1"},
		{"SUPERCARS_2026_3", "supercars_2026_1"}, // Sydney race 3 -> weekend 1
		{"SUPERCARS_2026_5", "supercars_2026_2"}, // Melbourne race 5 -> weekend 2
		{"SUPERCARS_2026_8", "supercars_2026_3"}, // Taupō
		{"SUPERCARS_2026_10", "supercars_2026_4"}, // Christchurch (Taupō R3 rescheduled)
		{"SUPERCARS_2026_13", "supercars_2026_4"}, // Christchurch
		{"SUPERCARS_2026_14", "supercars_2026_5"}, // Tasmania
		{"F1_2026_1", "f1_2026_1"},
	}
	for _, tc := range cases {
		got := ResolveEventDetailID(dataDir, tc.scheduleID)
		if got != tc.wantFile {
			t.Errorf("ResolveEventDetailID(%q) = %q, want %q", tc.scheduleID, got, tc.wantFile)
		}
	}
}
