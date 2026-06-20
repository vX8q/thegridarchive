package livesync

import "testing"

func TestNASCARManufacturerLabel(t *testing.T) {
	tests := map[string]string{
		"Tyt": "Toyota",
		"chv": "Chevrolet",
		"Frd": "Ford",
		"":    "",
		"XYZ": "XYZ",
	}
	for in, want := range tests {
		if got := nascarManufacturerLabel(in); got != want {
			t.Fatalf("nascarManufacturerLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNASCARLiveLeaderboardFrom(t *testing.T) {
	feed := &nascarCFLiveFeedJSON{
		RaceID: 1,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 2, VehicleNumber: "42", VehicleManufacturer: "Tyt", StartingPosition: 8, Delta: 0.558},
			{RunningPosition: 1, VehicleNumber: "45", VehicleManufacturer: "Tyt", StartingPosition: 16, Delta: 0},
		},
	}
	feed.Vehicles[0].Driver = nascarCFDriver{FullName: "John Hunter Nemechek"}
	feed.Vehicles[1].Driver = nascarCFDriver{FullName: "Tyler Reddick"}
	got := nascarLiveLeaderboardFrom(feed, 5)
	if len(got) != 2 {
		t.Fatalf("len = %d, want 2", len(got))
	}
	if got[0].Position != 1 || got[0].Driver != "Tyler Reddick" || got[0].Manufacturer != "Toyota" {
		t.Fatalf("leader: %+v", got[0])
	}
	if got[1].GapSeconds != 0.558 || got[1].StartingPosition != 8 {
		t.Fatalf("p2: %+v", got[1])
	}
}

func TestLiveEventIDsForNASCARSeries(t *testing.T) {
	ids := []string{"F1_2026_1", "NASCAR_CUP_2026_16", "NOAPS_2026_5", "NASCAR_TRUCK_2026_13"}
	if got := liveEventIDsForNASCARSeries(ids, 1); len(got) != 1 || got[0] != "NASCAR_CUP_2026_16" {
		t.Fatalf("cup: %#v", got)
	}
	if got := liveEventIDsForNASCARSeries(ids, 2); len(got) != 1 || got[0] != "NOAPS_2026_5" {
		t.Fatalf("xfinity: %#v", got)
	}
}
