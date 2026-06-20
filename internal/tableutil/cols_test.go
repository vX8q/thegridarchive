package tableutil

import "testing"

func TestColIndex_IgnoresTrailingPeriod(t *testing.T) {
	headers := []string{"Pos.", "No.", "Driver", "Laps", "Pts."}
	tests := []struct {
		name string
		want int
	}{
		{"Pos", 0},
		{"Pos.", 0},
		{"No", 1},
		{"No.", 1},
		{"Laps", 3},
		{"Pts", 4},
		{"Pts.", 4},
	}
	for _, tc := range tests {
		if got := ColIndex(headers, tc.name); got != tc.want {
			t.Errorf("ColIndex(%q) = %d, want %d", tc.name, got, tc.want)
		}
	}
}

func TestFirstColIndex_IgnoresTrailingPeriod(t *testing.T) {
	headers := []string{"Pos.", "Driver", "Laps"}
	if got := FirstColIndex(headers, "Pos", "Fin"); got != 0 {
		t.Fatalf("FirstColIndex = %d, want 0", got)
	}
}
