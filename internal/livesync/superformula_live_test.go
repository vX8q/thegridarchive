package livesync

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/schedulefile"
)

func loadSFRaceNowMessages(t *testing.T) []json.RawMessage {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", "sf_racenow_messages.json"))
	if err != nil {
		t.Fatalf("read sf messages: %v", err)
	}
	var msgs []json.RawMessage
	if err := json.Unmarshal(b, &msgs); err != nil {
		t.Fatalf("unmarshal sf messages: %v", err)
	}
	return msgs
}

func sfSnapshotFromMessages(t *testing.T) *sfRaceNowSnapshot {
	t.Helper()
	snap := &sfRaceNowSnapshot{}
	for _, msg := range loadSFRaceNowMessages(t) {
		applySuperFormulaRaceNowMessage(snap, msg)
	}
	return snap
}

func TestSuperFormulaSessionLooksLive(t *testing.T) {
	snap := sfSnapshotFromMessages(t)
	if !superFormulaSessionLooksLive(snap) {
		t.Fatal("fixture should look live")
	}
	snap.Heartbeat.Flag = "F"
	if superFormulaSessionLooksLive(snap) {
		t.Fatal("finished flag should not look live")
	}
}

func TestSuperFormulaLeaderboardFrom(t *testing.T) {
	snap := sfSnapshotFromMessages(t)
	leaders := superFormulaLeaderboardFrom(snap.Rows, "R", 0)
	if len(leaders) != 3 {
		t.Fatalf("leader count = %d", len(leaders))
	}
	if leaders[0].CarNumber != "1" || leaders[0].GapDisplay != "—" {
		t.Fatalf("leader = %#v", leaders[0])
	}
	if leaders[2].GapDisplay != "+1 LAP" {
		t.Fatalf("lapped gap = %q", leaders[2].GapDisplay)
	}
}

func TestSuperFormulaBoardFromSnapshot(t *testing.T) {
	snap := sfSnapshotFromMessages(t)
	board, err := superFormulaBoardFromSnapshot(snap, t.TempDir(), 5)
	if err != nil {
		t.Fatalf("board: %v", err)
	}
	if board.SeriesKey != superFormulaSeriesKey || board.LapNumber != 12 {
		t.Fatalf("board = %#v", board)
	}
}

func TestCollectSuperFormulaLiveBoards_Mock(t *testing.T) {
	orig := fetchSuperFormulaSnapshotFunc
	defer func() { fetchSuperFormulaSnapshotFunc = orig }()

	snap := sfSnapshotFromMessages(t)
	fetchSuperFormulaSnapshotFunc = func(_ context.Context) (*sfRaceNowSnapshot, error) {
		snapCopy := *snap
		snapCopy.Rows = append([]sfRaceNowRow(nil), snap.Rows...)
		if snap.Schedule != nil {
			s := *snap.Schedule
			snapCopy.Schedule = &s
		}
		if snap.Heartbeat != nil {
			h := *snap.Heartbeat
			snapCopy.Heartbeat = &h
		}
		return &snapCopy, nil
	}
	refreshSuperFormulaCache(context.Background())

	boards := CollectSuperFormulaLiveBoards(t.TempDir(), 10)
	if len(boards) != 1 || len(boards[0].Leaders) == 0 {
		t.Fatalf("boards = %#v", boards)
	}
}

func TestSyncSuperFormula_Merge(t *testing.T) {
	orig := fetchSuperFormulaSnapshotFunc
	origNow := superFormulaNowFunc
	defer func() {
		fetchSuperFormulaSnapshotFunc = orig
		superFormulaNowFunc = origNow
	}()

	day := time.Date(2026, 4, 5, 10, 0, 0, 0, time.UTC)
	superFormulaNowFunc = func() time.Time { return day }
	snap := sfSnapshotFromMessages(t)
	fetchSuperFormulaSnapshotFunc = func(_ context.Context) (*sfRaceNowSnapshot, error) {
		return snap, nil
	}
	refreshSuperFormulaCache(context.Background())

	dir := t.TempDir()
	schedDir := filepath.Join(dir, "schedules")
	if err := os.MkdirAll(schedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	sched := `[{"id":"SUPER_FORMULA_2026_2","start_date":"2026-04-05"}]`
	if err := os.WriteFile(filepath.Join(schedDir, "super_formula.json"), []byte(sched), 0o644); err != nil {
		t.Fatal(err)
	}
	livePath := filepath.Join(dir, "live.json")
	if err := os.WriteFile(livePath, []byte(`["WEC_2026_1"]`), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := SyncSuperFormula(dir); err != nil {
		t.Fatalf("SyncSuperFormula: %v", err)
	}
	got := readLiveIDs(livePath)
	if len(got) != 2 || got[1] != "SUPER_FORMULA_2026_2" {
		t.Fatalf("live ids = %#v", got)
	}
}

func TestFindSuperFormulaLiveEvent_PrefersClosestWeekendDay(t *testing.T) {
	events := []schedulefile.EventJSON{
		{ID: "SUPER_FORMULA_2026_1", StartDate: "2026-04-04"},
		{ID: "SUPER_FORMULA_2026_2", StartDate: "2026-04-05"},
	}
	day := time.Date(2026, 4, 5, 12, 0, 0, 0, time.UTC)
	if got := findSuperFormulaLiveEvent(events, day); got != "SUPER_FORMULA_2026_2" {
		t.Fatalf("got %q", got)
	}
}

func TestMergeLiveJSONSuperFormula(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "live.json")
	if err := os.WriteFile(path, []byte(`["SUPER_FORMULA_2026_1","WEC_2026_1"]`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := mergeLiveJSONSuperFormula(path, []string{"SUPER_FORMULA_2026_2"}); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(path)
	const want = "[\n  \"WEC_2026_1\",\n  \"SUPER_FORMULA_2026_2\"\n]"
	if string(got) != want {
		t.Fatalf("live.json = %s, want %s", string(got), want)
	}
}
