package livesync

import (
	"testing"
	"time"
)

func TestNASCARFeedLooksLive(t *testing.T) {
	live := &nascarCFLiveFeedJSON{
		RaceID:    100,
		SeriesID:  2,
		LapNumber: 12,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, Driver: nascarCFDriver{FullName: "Driver One"}},
		},
	}
	if !nascarFeedLooksLive(live, 2) {
		t.Fatal("expected live feed for matching series")
	}
	if nascarFeedLooksLive(live, 1) {
		t.Fatal("expected reject when series_id mismatch")
	}

	stale := &nascarCFLiveFeedJSON{
		RaceID:    100,
		SeriesID:  3,
		LapNumber: 0,
		FlagState: 0,
		Vehicles:  []nascarCFVehicle{{RunningPosition: 0, Driver: nascarCFDriver{FullName: "Idle"}}},
	}
	if nascarFeedLooksLive(stale, 3) {
		t.Fatal("expected stale feed to be rejected")
	}

	practice := &nascarCFLiveFeedJSON{
		RaceID:     5613,
		SeriesID:   1,
		LapNumber:  1,
		FlagState:  9,
		LapsInRace: 999,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
		},
	}
	if nascarFeedLooksLive(practice, 1) {
		t.Fatal("expected practice placeholder feed to be rejected")
	}

	finished := &nascarCFLiveFeedJSON{
		RaceID:     200,
		SeriesID:   1,
		LapNumber:  160,
		LapsInRace: 160,
		LapsToGo:   0,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, LapsCompleted: 160, Driver: nascarCFDriver{FullName: "Denny Hamlin"}},
			{RunningPosition: 2, LapsCompleted: 160, Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
		},
	}
	if nascarFeedLooksLive(finished, 1) {
		t.Fatal("expected finished feed to be rejected")
	}
	if !nascarFeedRaceFinished(finished) {
		t.Fatal("expected finished feed")
	}

	finalLap := &nascarCFLiveFeedJSON{
		RaceID:     201,
		SeriesID:   1,
		LapNumber:  160,
		LapsInRace: 160,
		LapsToGo:   0,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, LapsCompleted: 159, Driver: nascarCFDriver{FullName: "Leader"}},
		},
	}
	if nascarFeedRaceFinished(finalLap) {
		t.Fatal("final green-flag lap should not be finished")
	}
	if !nascarFeedLooksLive(finalLap, 1) {
		t.Fatal("expected final lap to still look live")
	}
}

func TestNASCARFeedCountsAsLiveRace(t *testing.T) {
	origNow := nascarNowFunc
	defer func() { nascarNowFunc = origNow }()
	// Saturday before a Sunday Cup race (Eastern).
	nascarNowFunc = func() time.Time {
		return time.Date(2026, 6, 20, 15, 0, 0, 0, time.UTC)
	}

	feed := &nascarCFLiveFeedJSON{
		RaceID:     5613,
		SeriesID:   1,
		LapNumber:  1,
		FlagState:  9,
		LapsInRace: 999,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
		},
	}
	if nascarFeedCountsAsLiveRace(feed, "2026-06-21") {
		t.Fatal("expected tomorrow's practice payload to be rejected")
	}

	raceDay := &nascarCFLiveFeedJSON{
		RaceID:     5613,
		SeriesID:   1,
		LapNumber:  42,
		FlagState:  1,
		LapsInRace: 160,
		Vehicles: []nascarCFVehicle{
			{RunningPosition: 1, Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
		},
	}
	nascarNowFunc = func() time.Time {
		return time.Date(2026, 6, 21, 18, 0, 0, 0, time.UTC)
	}
	if !nascarFeedCountsAsLiveRace(raceDay, "2026-06-21") {
		t.Fatal("expected active race-day feed to count as live")
	}
}

func TestNASCARSeriesMetaIncludesOReillyAndTruck(t *testing.T) {
	for _, seriesID := range []int{1, 2, 3} {
		if _, ok := nascarSeriesMeta[seriesID]; !ok {
			t.Fatalf("missing series meta for %d", seriesID)
		}
	}
	if nascarSeriesMeta[2].SeriesKey != "NOAPS" {
		t.Fatalf("series 2 key: %s", nascarSeriesMeta[2].SeriesKey)
	}
	if nascarSeriesMeta[3].SeriesKey != "NASCAR_TRUCK" {
		t.Fatalf("series 3 key: %s", nascarSeriesMeta[3].SeriesKey)
	}
}
