package livesync

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func loadWECSample(t *testing.T) *wecLiveSnapshot {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", "wec_sample.json"))
	if err != nil {
		t.Fatalf("read wec sample: %v", err)
	}
	var snap wecLiveSnapshot
	if err := json.Unmarshal(b, &snap); err != nil {
		t.Fatalf("unmarshal wec sample: %v", err)
	}
	return &snap
}

func TestWECRaceStateFinished(t *testing.T) {
	if !wecRaceStateFinished("Chk") {
		t.Fatal("Chk should be finished")
	}
	if wecRaceStateFinished("Grn") {
		t.Fatal("Grn should not be finished")
	}
}

func TestWECSessionLooksLive_FinishedSample(t *testing.T) {
	snap := loadWECSample(t)
	if wecSessionLooksLive(snap, time.Now().UTC()) {
		t.Fatal("finished WEC sample should not look live")
	}
}

func TestWECSessionLooksLive_ActiveRace(t *testing.T) {
	snap := loadWECSample(t)
	snap.Params.RaceState = "Grn"
	snap.Params.PercentProgressLive = 42
	snap.Params.Remaining = 3600
	snap.Params.StartTime = float64(time.Now().Add(-2 * time.Hour).UnixMilli())
	snap.Params.Duration = 86400
	if !wecSessionLooksLive(snap, time.Now().UTC()) {
		t.Fatal("active WEC session should look live")
	}
}

func TestWECLeaderboardFrom(t *testing.T) {
	snap := loadWECSample(t)
	leaders := wecLeaderboardFrom(snap.Entries, 3)
	if len(leaders) != 3 {
		t.Fatalf("leader count = %d, want 3", len(leaders))
	}
	if leaders[0].Position != 1 || leaders[0].Driver == "" {
		t.Fatalf("leader = %#v", leaders[0])
	}
	if leaders[0].GapDisplay != "—" {
		t.Fatalf("leader gap = %q", leaders[0].GapDisplay)
	}
}

func TestWECBoardFromSnapshot(t *testing.T) {
	snap := loadWECSample(t)
	snap.Params.RaceState = "Grn"
	snap.Params.PercentProgressLive = 50
	snap.Params.Remaining = 1000
	dir := t.TempDir()
	board, err := wecBoardFromSnapshot(snap, dir, 5)
	if err != nil {
		t.Fatalf("board: %v", err)
	}
	if board.SeriesKey != wecSeriesKey || len(board.Leaders) == 0 {
		t.Fatalf("board = %#v", board)
	}
	if board.RunName != "Race" {
		t.Fatalf("run name = %q", board.RunName)
	}
}

func TestCollectWECLiveBoards_Mock(t *testing.T) {
	orig := fetchWECLiveSnapshotFunc
	defer func() { fetchWECLiveSnapshotFunc = orig }()

	snap := loadWECSample(t)
	snap.Params.RaceState = "Grn"
	snap.Params.PercentProgressLive = 50
	snap.Params.Remaining = 1000
	snap.Params.StartTime = float64(time.Now().Add(-time.Hour).UnixMilli())
	fetchWECLiveSnapshotFunc = func() (*wecLiveSnapshot, error) { return snap, nil }

	boards := CollectWECLiveBoards(t.TempDir(), 10)
	if len(boards) != 1 || len(boards[0].Leaders) == 0 {
		t.Fatalf("boards = %#v", boards)
	}
}

func TestSyncWEC_Merge(t *testing.T) {
	orig := fetchWECLiveSnapshotFunc
	origNow := wecNowFunc
	defer func() {
		fetchWECLiveSnapshotFunc = orig
		wecNowFunc = origNow
	}()

	weekend := time.Date(2026, 4, 19, 12, 0, 0, 0, time.UTC)
	wecNowFunc = func() time.Time { return weekend }

	snap := loadWECSample(t)
	snap.Params.RaceState = "Grn"
	snap.Params.PercentProgressLive = 40
	snap.Params.Remaining = 5000
	snap.Params.StartTime = float64(weekend.UnixMilli())
	fetchWECLiveSnapshotFunc = func() (*wecLiveSnapshot, error) { return snap, nil }

	dir := t.TempDir()
	schedDir := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(schedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sched := `[{"id":"WEC_2026_1","start_date":"2026-04-19"}]`
	if err := os.WriteFile(filepath.Join(schedDir, "wec.json"), []byte(sched), 0o644); err != nil {
		t.Fatal(err)
	}
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["F1_2026_1"]`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := SyncWEC(dir); err != nil {
		t.Fatalf("SyncWEC: %v", err)
	}
	got := readLiveIDs(livePath)
	if len(got) != 2 || got[1] != "WEC_2026_1" {
		t.Fatalf("live ids = %#v", got)
	}
}

func TestMergeLiveJSONWEC(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.json")
	if err := os.WriteFile(path, []byte(`["WEC_2026_1","F1_2026_1"]`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := mergeLiveJSONWEC(path, []string{"WEC_2026_2"}); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	const want = "[\n  \"F1_2026_1\",\n  \"WEC_2026_2\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}
