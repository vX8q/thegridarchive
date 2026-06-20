package livesync

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/schedulefile"
)

func TestFindEventByDate_ExactMatch(t *testing.T) {
	events := []schedulefile.EventJSON{
		{ID: "E1", StartDate: "2026-03-01"},
		{ID: "E2", StartDate: "2026-03-08"},
	}
	id := findEventByDate(events, "2026-03-08T10:00:00Z", false)
	if id != "E2" {
		t.Fatalf("findEventByDate exact = %q, want %q", id, "E2")
	}
}

func TestFindEventByDate_WeekendFallback(t *testing.T) {
	events := []schedulefile.EventJSON{
		{ID: "E1", StartDate: "2026-03-01"}, // Sunday
	}
	// Session on Friday of the same weekend.
	id := findEventByDate(events, "2026-02-28", true)
	if id != "E1" {
		t.Fatalf("findEventByDate weekend = %q, want %q", id, "E1")
	}
}

func TestMergeLiveJSONNASCAR_FilterAndAppend(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.json")
	if err := os.WriteFile(path, []byte(`["F1_2026_1","NASCAR_CUP_2026_1"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}
	if err := mergeLiveJSONNASCAR(path, []string{"NASCAR_CUP_2026_2"}); err != nil {
		t.Fatalf("mergeLiveJSONNASCAR error: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	// Expect F1 kept, old NASCAR removed, new one added.
	const want = "[\n  \"F1_2026_1\",\n  \"NASCAR_CUP_2026_2\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}

func TestMergeLiveJSONF1_FilterAndAppend(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.json")
	if err := os.WriteFile(path, []byte(`["F1_2026_1","NASCAR_CUP_2026_1"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}
	if err := mergeLiveJSONF1(path, []string{"F1_2026_2"}); err != nil {
		t.Fatalf("mergeLiveJSONF1 error: %v", err)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	// Expect NASCAR kept, old F1 removed, new one added.
	const want = "[\n  \"NASCAR_CUP_2026_1\",\n  \"F1_2026_2\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}

func TestReadLiveIDs_SupportsObjectAndArray(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.json")

	// New format: object with live_event_ids field.
	if err := os.WriteFile(path, []byte(`{"live_event_ids":["E1","E2"]}`), 0o644); err != nil {
		t.Fatalf("write object live.json: %v", err)
	}
	ids := readLiveIDs(path)
	if len(ids) != 2 || ids[0] != "E1" || ids[1] != "E2" {
		t.Fatalf("readLiveIDs(object) = %#v, want [\"E1\",\"E2\"]", ids)
	}

	// Old format: plain string array.
	if err := os.WriteFile(path, []byte(`["X1","X2"]`), 0o644); err != nil {
		t.Fatalf("write array live.json: %v", err)
	}
	ids = readLiveIDs(path)
	if len(ids) != 2 || ids[0] != "X1" || ids[1] != "X2" {
		t.Fatalf("readLiveIDs(array) = %#v, want [\"X1\",\"X2\"]", ids)
	}
}

func TestSyncNASCAR_GracefulOnEmptyFeed(t *testing.T) {
	origFetchLive := fetchNASCARLiveFeedFullFunc
	origFetchRaces := fetchNASCARRacesFunc
	fetchNASCARLiveFeedFullFunc = func() (*nascarCFLiveFeedJSON, error) {
		return nil, fmt.Errorf("network down")
	}
	fetchNASCARRacesFunc = func(_, _ int) ([]nascarRace, error) {
		return nil, fmt.Errorf("should not be called")
	}
	defer func() {
		fetchNASCARLiveFeedFullFunc = origFetchLive
		fetchNASCARRacesFunc = origFetchRaces
	}()

	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["F1_2026_1","NASCAR_CUP_2026_1"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}

	if err := SyncNASCAR(dir); err != nil {
		t.Fatalf("SyncNASCAR error: %v", err)
	}
	got, err := os.ReadFile(livePath)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	// Expect NASCAR entry cleared, F1 kept.
	const want = "[\n  \"F1_2026_1\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}

func TestSyncNASCAR_ClearsLiveWhenRaceFinished(t *testing.T) {
	origFetchLive := fetchNASCARLiveFeedFullFunc
	origFetchRaces := fetchNASCARRacesFunc
	fetchNASCARLiveFeedFullFunc = func() (*nascarCFLiveFeedJSON, error) {
		return &nascarCFLiveFeedJSON{
			RaceID:     1,
			SeriesID:   1,
			LapNumber:  160,
			LapsInRace: 160,
			Vehicles: []nascarCFVehicle{
				{RunningPosition: 1, LapsCompleted: 160, Driver: nascarCFDriver{FullName: "Winner"}},
			},
		}, nil
	}
	fetchNASCARRacesFunc = func(_, _ int) ([]nascarRace, error) {
		t.Fatal("should not fetch races when feed is finished")
		return nil, nil
	}
	defer func() {
		fetchNASCARLiveFeedFullFunc = origFetchLive
		fetchNASCARRacesFunc = origFetchRaces
	}()

	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["NASCAR_CUP_2026_16"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}
	if err := SyncNASCAR(dir); err != nil {
		t.Fatalf("SyncNASCAR error: %v", err)
	}
	got, err := os.ReadFile(livePath)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	const want = "[]"
	if strings.TrimSpace(string(got)) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}

func TestSyncNASCAR_ClearsLiveWhenNotRaceDay(t *testing.T) {
	origFetchLive := fetchNASCARLiveFeedFullFunc
	origFetchRaces := fetchNASCARRacesFunc
	origNow := nascarNowFunc
	fetchNASCARLiveFeedFullFunc = func() (*nascarCFLiveFeedJSON, error) {
		return &nascarCFLiveFeedJSON{
			RaceID:     5613,
			LapNumber:  1,
			FlagState:  9,
			LapsInRace: 999,
			Vehicles: []nascarCFVehicle{
				{RunningPosition: 1, Driver: nascarCFDriver{FullName: "Tyler Reddick"}},
			},
		}, nil
	}
	fetchNASCARRacesFunc = func(seriesID, _ int) ([]nascarRace, error) {
		if seriesID != 1 {
			return nil, nil
		}
		return []nascarRace{{RaceID: 5613, DateScheduled: "2026-06-21T20:00:00Z"}}, nil
	}
	nascarNowFunc = func() time.Time {
		return time.Date(2026, 6, 20, 15, 0, 0, 0, time.UTC)
	}
	defer func() {
		fetchNASCARLiveFeedFullFunc = origFetchLive
		fetchNASCARRacesFunc = origFetchRaces
		nascarNowFunc = origNow
	}()

	dir := t.TempDir()
	schedDir := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(schedDir, 0o755); err != nil {
		t.Fatalf("mkdir schedules: %v", err)
	}
	sched := `[{"id":"NASCAR_CUP_2026_17","series_id":"NASCAR_CUP","season":"2026","name":"Anduril 250","start_date":"2026-06-21","end_date":"2026-06-21"}]`
	if err := os.WriteFile(filepath.Join(schedDir, "nascar_cup.json"), []byte(sched), 0o644); err != nil {
		t.Fatalf("write schedule: %v", err)
	}
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["NASCAR_CUP_2026_17"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}
	if err := SyncNASCAR(dir); err != nil {
		t.Fatalf("SyncNASCAR error: %v", err)
	}
	got, err := os.ReadFile(livePath)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	if strings.TrimSpace(string(got)) != "[]" {
		t.Fatalf("live.json = %s, want []", string(got))
	}
}

func TestSyncOpenF1_GracefulOnNoSessions(t *testing.T) {
	origMeet := fetchOpenF1LatestMeetingSessionsFunc
	origLatest := fetchOpenF1SessionsLatestRawFunc
	fetchOpenF1LatestMeetingSessionsFunc = func() ([]openF1SessionFull, error) {
		return nil, nil
	}
	fetchOpenF1SessionsLatestRawFunc = func() ([]openF1SessionFull, error) {
		return nil, nil
	}
	defer func() {
		fetchOpenF1LatestMeetingSessionsFunc = origMeet
		fetchOpenF1SessionsLatestRawFunc = origLatest
	}()

	dir := t.TempDir()
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["F1_2026_1","NASCAR_CUP_2026_1"]`), 0o644); err != nil {
		t.Fatalf("write seed live.json: %v", err)
	}

	if err := SyncOpenF1(dir); err != nil {
		t.Fatalf("SyncOpenF1 error: %v", err)
	}
	got, err := os.ReadFile(livePath)
	if err != nil {
		t.Fatalf("read live.json: %v", err)
	}
	// Expect F1 entry cleared, NASCAR kept.
	const want = "[\n  \"NASCAR_CUP_2026_1\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}

