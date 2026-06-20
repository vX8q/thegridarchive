package livesync

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParseOpenF1Time(t *testing.T) {
	got, err := parseOpenF1Time("2026-06-14T13:03:38.385000+00:00")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if got.Format(time.RFC3339) != "2026-06-14T13:03:38Z" {
		t.Fatalf("got %s", got.Format(time.RFC3339))
	}
}

func TestPickOpenF1LiveSession_PrefersRace(t *testing.T) {
	now := time.Date(2026, 6, 14, 13, 30, 0, 0, time.UTC)
	sessions := []openF1SessionFull{
		{
			SessionKey:  1,
			SessionType: "Practice",
			DateStart:   "2026-06-14T11:00:00+00:00",
			DateEnd:     "2026-06-14T12:00:00+00:00",
		},
		{
			SessionKey:  2,
			SessionType: "Race",
			DateStart:   "2026-06-14T13:00:00+00:00",
			DateEnd:     "2026-06-14T15:00:00+00:00",
		},
	}
	got := pickOpenF1LiveSession(sessions, now)
	if got == nil || got.SessionKey != 2 {
		t.Fatalf("pick = %#v, want race session", got)
	}
}

func TestLatestOpenF1PositionByDriver(t *testing.T) {
	rows := []openF1PositionRow{
		{Date: "2026-06-14T12:00:00+00:00", DriverNumber: 63, Position: 2},
		{Date: "2026-06-14T13:00:00+00:00", DriverNumber: 63, Position: 1},
		{Date: "2026-06-14T13:00:00+00:00", DriverNumber: 44, Position: 3},
	}
	got := latestOpenF1PositionByDriver(rows)
	if got[63].Position != 1 || got[44].Position != 3 {
		t.Fatalf("latest positions: %#v", got)
	}
}

func TestFormatOpenF1GapRaw(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{`null`, ""},
		{`1.234`, "+1.234s"},
		{`"+1 LAP"`, "+1 LAP"},
		{`"2.5"`, "+2.5s"},
	}
	for _, tc := range tests {
		got := formatOpenF1GapRaw(json.RawMessage(tc.raw))
		if got != tc.want {
			t.Fatalf("formatOpenF1GapRaw(%s) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}

func TestF1LeaderboardFrom(t *testing.T) {
	session := &openF1SessionFull{SessionType: "Race"}
	positions := map[int]openF1PositionRow{
		63: {DriverNumber: 63, Position: 1},
		44: {DriverNumber: 44, Position: 2},
	}
	drivers := map[int]openF1Driver{
		63: {DriverNumber: 63, FirstName: "George", LastName: "Russell", TeamName: "Mercedes"},
		44: {DriverNumber: 44, FirstName: "Lewis", LastName: "Hamilton", TeamName: "Ferrari"},
	}
	grid := map[int]int{63: 2, 44: 1}
	gaps := map[int]string{44: "+1.5s"}

	got := f1LeaderboardFrom(session, positions, drivers, grid, gaps, 0)
	if len(got) != 2 {
		t.Fatalf("len = %d", len(got))
	}
	if got[0].Driver != "George Russell" || got[0].GapDisplay != "—" {
		t.Fatalf("leader: %+v", got[0])
	}
	if got[1].GapDisplay != "+1.5s" || got[1].StartingPosition != 1 {
		t.Fatalf("p2: %+v", got[1])
	}
}

func TestCollectF1LiveBoards_WithMocks(t *testing.T) {
	origMeet := fetchOpenF1LatestMeetingSessionsFunc
	origLatest := fetchOpenF1SessionsLatestRawFunc
	origDrivers := fetchOpenF1DriversFunc
	origPos := fetchOpenF1PositionsFunc
	origGrid := fetchOpenF1StartingGridFunc
	origIntervals := fetchOpenF1IntervalsForDriverFunc
	origLaps := fetchOpenF1LapsFunc
	origNow := openF1NowFunc
	defer func() {
		fetchOpenF1LatestMeetingSessionsFunc = origMeet
		fetchOpenF1SessionsLatestRawFunc = origLatest
		fetchOpenF1DriversFunc = origDrivers
		fetchOpenF1PositionsFunc = origPos
		fetchOpenF1StartingGridFunc = origGrid
		fetchOpenF1IntervalsForDriverFunc = origIntervals
		fetchOpenF1LapsFunc = origLaps
		openF1NowFunc = origNow
	}()

	openF1NowFunc = func() time.Time {
		return time.Date(2026, 6, 28, 13, 30, 0, 0, time.UTC)
	}
	fetchOpenF1LatestMeetingSessionsFunc = func() ([]openF1SessionFull, error) {
		return []openF1SessionFull{{
			SessionKey:       9001,
			SessionType:      "Race",
			SessionName:      "Race",
			DateStart:        "2026-06-28T13:00:00+00:00",
			DateEnd:          "2026-06-28T15:00:00+00:00",
			CircuitShortName: "Spielberg",
			Location:         "Spielberg",
		}}, nil
	}
	fetchOpenF1SessionsLatestRawFunc = func() ([]openF1SessionFull, error) {
		return nil, nil
	}
	fetchOpenF1DriversFunc = func(int) ([]openF1Driver, error) {
		return []openF1Driver{
			{DriverNumber: 1, FirstName: "Lando", LastName: "Norris", TeamName: "McLaren"},
			{DriverNumber: 44, FirstName: "Lewis", LastName: "Hamilton", TeamName: "Ferrari"},
		}, nil
	}
	fetchOpenF1PositionsFunc = func(int) ([]openF1PositionRow, error) {
		return []openF1PositionRow{
			{Date: "2026-06-28T13:10:00+00:00", DriverNumber: 1, Position: 1},
			{Date: "2026-06-28T13:10:00+00:00", DriverNumber: 44, Position: 2},
		}, nil
	}
	fetchOpenF1StartingGridFunc = func(int) ([]openF1StartingGridRow, error) {
		return []openF1StartingGridRow{
			{DriverNumber: 1, Position: 2},
			{DriverNumber: 44, Position: 1},
		}, nil
	}
	fetchOpenF1IntervalsForDriverFunc = func(_ int, driverNumber int) ([]openF1IntervalRow, error) {
		if driverNumber == 44 {
			return []openF1IntervalRow{
				{Date: "2026-06-28T13:10:00+00:00", DriverNumber: 44, GapToLeader: json.RawMessage(`1.2`)},
			}, nil
		}
		return nil, nil
	}
	fetchOpenF1LapsFunc = func(_, driverNumber int) ([]openF1LapRow, error) {
		if driverNumber == 1 {
			return []openF1LapRow{{LapNumber: 12}}, nil
		}
		return nil, nil
	}

	dir := t.TempDir()
	schedDir := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(schedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sched := `[{"id":"F1_2026_8","series_id":"F1","season":"2026","name":"Austrian GP","start_date":"2026-06-28","end_date":"2026-06-28"}]`
	if err := os.WriteFile(filepath.Join(schedDir, "f1.json"), []byte(sched), 0o644); err != nil {
		t.Fatal(err)
	}

	boards := CollectF1LiveBoards(dir, 0)
	if len(boards) != 1 {
		t.Fatalf("boards = %#v", boards)
	}
	b := boards[0]
	if b.SeriesKey != "F1" || b.EventID != "F1_2026_8" || b.LapNumber != 12 {
		t.Fatalf("board: %+v", b)
	}
	if len(b.Leaders) != 2 || b.Leaders[1].GapDisplay != "+1.2s" {
		t.Fatalf("leaders: %#v", b.Leaders)
	}
}

func TestSyncOpenF1_WritesEventDuringLiveSession(t *testing.T) {
	origMeet := fetchOpenF1LatestMeetingSessionsFunc
	origLatest := fetchOpenF1SessionsLatestRawFunc
	origNow := openF1NowFunc
	defer func() {
		fetchOpenF1LatestMeetingSessionsFunc = origMeet
		fetchOpenF1SessionsLatestRawFunc = origLatest
		openF1NowFunc = origNow
	}()

	openF1NowFunc = func() time.Time {
		return time.Date(2026, 6, 28, 13, 30, 0, 0, time.UTC)
	}
	fetchOpenF1LatestMeetingSessionsFunc = func() ([]openF1SessionFull, error) {
		return []openF1SessionFull{{
			SessionKey:  9001,
			SessionType: "Qualifying",
			DateStart:   "2026-06-28T13:00:00+00:00",
			DateEnd:     "2026-06-28T14:00:00+00:00",
		}}, nil
	}
	fetchOpenF1SessionsLatestRawFunc = func() ([]openF1SessionFull, error) {
		return nil, nil
	}

	dir := t.TempDir()
	schedDir := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(schedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sched := `[{"id":"F1_2026_8","series_id":"F1","season":"2026","name":"Austrian GP","start_date":"2026-06-28","end_date":"2026-06-28"}]`
	if err := os.WriteFile(filepath.Join(schedDir, "f1.json"), []byte(sched), 0o644); err != nil {
		t.Fatal(err)
	}
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["NASCAR_CUP_2026_16"]`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := SyncOpenF1(dir); err != nil {
		t.Fatalf("SyncOpenF1: %v", err)
	}
	got, err := os.ReadFile(livePath)
	if err != nil {
		t.Fatal(err)
	}
	const want = "[\n  \"NASCAR_CUP_2026_16\",\n  \"F1_2026_8\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}
