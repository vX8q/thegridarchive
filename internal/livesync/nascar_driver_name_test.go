package livesync

import "testing"

func TestNormalizeNASCARLiveDriverName(t *testing.T) {
	tests := map[string]string{
		"* Casey Mears":     "Casey Mears",
		"** Christian Dye":  "Christian Dye",
		" Tyler Reddick":    "Tyler Reddick",
		"* Shane van Gisbergen": "Shane van Gisbergen",
	}
	for in, want := range tests {
		if got := normalizeNASCARLiveDriverName(in); got != want {
			t.Fatalf("normalizeNASCARLiveDriverName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNASCARDriverDisplayName(t *testing.T) {
	got := nascarDriverDisplayName(nascarCFDriver{
		FullName:  "* Casey Mears",
		FirstName: "Casey",
		LastName:  "Mears",
	})
	if got != "Casey Mears" {
		t.Fatalf("substitute driver: got %q", got)
	}
	got = nascarDriverDisplayName(nascarCFDriver{
		FullName:  "#",
		FirstName: "Carson",
		LastName:  "Hocevar",
	})
	if got != "Carson Hocevar" {
		t.Fatalf("invalid full_name fallback: got %q", got)
	}
	got = nascarDriverDisplayName(nascarCFDriver{
		FullName:  "Carson #",
		FirstName: "Carson",
		LastName:  "Hocevar",
	})
	if got != "Carson Hocevar" {
		t.Fatalf("carson hash fallback: got %q", got)
	}
}

func TestNASCARLiveLeaderboardSkipsInvalidDriver(t *testing.T) {
	feed := &nascarCFLiveFeedJSON{
		RaceID: 1,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, VehicleNumber: "88", Driver: nascarCFDriver{FullName: "#"}},
			{RunningPosition: 2, VehicleNumber: "45", Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
		},
	}
	got := nascarLiveLeaderboardFrom(feed, 0)
	if len(got) != 1 || got[0].Driver != "Tyler Reddick" {
		t.Fatalf("leaderboard: %+v", got)
	}
}
