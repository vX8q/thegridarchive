package schedulefile

import "testing"

func TestRecomputeCompletedRacesFromFilled_SkipsGapInMiddle(t *testing.T) {
	data := &StandingsData{
		RaceOrder: []string{"R1", "R2", "R3"},
		Rows: []StandingRow{
			{
				Driver: "A",
				Races: map[string]string{
					"R1": "1",
					"R3": "2",
				},
			},
		},
	}
	RecomputeCompletedRacesFromFilled(data)
	want := []string{"R1", "R3"}
	if len(data.CompletedRaces) != len(want) {
		t.Fatalf("got %v, want %v", data.CompletedRaces, want)
	}
	for i := range want {
		if data.CompletedRaces[i] != want[i] {
			t.Fatalf("index %d: got %q, want %q", i, data.CompletedRaces[i], want[i])
		}
	}
}

func TestRecomputeCompletedRacesFromFilled_IgnoresPlaceholderDash(t *testing.T) {
	data := &StandingsData{
		RaceOrder: []string{"R1", "R2"},
		Rows: []StandingRow{
			{
				Driver: "A",
				Races: map[string]string{
					"R1": "—",
					"R2": "3",
				},
			},
		},
	}
	RecomputeCompletedRacesFromFilled(data)
	want := []string{"R2"}
	if len(data.CompletedRaces) != 1 || data.CompletedRaces[0] != want[0] {
		t.Fatalf("got %v, want %v", data.CompletedRaces, want)
	}
}
