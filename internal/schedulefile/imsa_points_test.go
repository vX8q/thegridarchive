package schedulefile

import "testing"

func TestImsaRacePointsByPos(t *testing.T) {
	tests := []struct {
		pos  int
		want float64
	}{
		{0, 0},
		{1, 350},
		{2, 320},
		{6, 250},
		{10, 210},
		{20, 110},
		{30, 10},
		{31, 10},
	}
	for _, tc := range tests {
		if got := imsaRacePointsByPos(tc.pos); got != tc.want {
			t.Errorf("imsaRacePointsByPos(%d) = %v, want %v", tc.pos, got, tc.want)
		}
	}
}

func TestImsaQualifyingPointsByPos(t *testing.T) {
	tests := []struct {
		pos  int
		want float64
	}{
		{0, 0},
		{1, 35},
		{2, 32},
		{3, 30},
		{4, 28},
		{6, 25},
		{7, 24},
		{10, 21},
		{14, 17},
		{20, 11},
		{29, 2},
		{30, 1},
		{31, 1},
	}
	for _, tc := range tests {
		if got := imsaQualifyingPointsByPos(tc.pos); got != tc.want {
			t.Errorf("imsaQualifyingPointsByPos(%d) = %v, want %v", tc.pos, got, tc.want)
		}
	}
}
