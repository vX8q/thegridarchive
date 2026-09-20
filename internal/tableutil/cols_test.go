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

func TestRacePosColIndex_FinST(t *testing.T) {
	headers := []string{"Fin / ST", "No.", "Driver", "Team", "Laps", "Pts"}
	if got := RacePosColIndex(headers); got != 0 {
		t.Fatalf("RacePosColIndex = %d, want 0", got)
	}
	if got := NormalizeRacePos("1 / ST 2 ▲1"); got != "1" {
		t.Fatalf("NormalizeRacePos = %q, want 1", got)
	}
	if got := NormalizeRacePos("NC / ST 28"); got != "NC" {
		t.Fatalf("NormalizeRacePos = %q, want NC", got)
	}
}
