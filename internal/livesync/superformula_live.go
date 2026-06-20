package livesync

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/vX8q/tga/internal/schedulefile"
)

const (
	superFormulaWSURL     = "ws://superformula.racelive.jp:6001/get"
	superFormulaLivePage  = "http://superformula.racelive.jp/live"
	superFormulaSeriesKey = "SUPER_FORMULA"
	superFormulaSeriesName = "Super Formula"
	superFormulaWSTimeout = 8 * time.Second
	superFormulaCacheTTL  = 30 * time.Second
)

type sfRaceNowRow struct {
	CarNo     string  `json:"CARNO"`
	DriverE   string  `json:"DRIVER_E"`
	TeamE     string  `json:"TEAM_E"`
	Laps      int     `json:"LAPS"`
	TotalTime float64 `json:"TOTAL_TIME"`
	StartPos  int     `json:"START_POS"`
	RunFlag   string  `json:"RUN_FLAG"`
	Maker     string  `json:"MAKER"`
}

type sfRaceNowSchedule struct {
	Category string `json:"CATEGORY"`
	DescrJ   string `json:"DESCR_J"`
	RaceType string `json:"RACE_TYPE"`
}

type sfRaceNowHeartbeat struct {
	Flag string `json:"flag"`
	Togo string `json:"togo"`
}

type sfRaceNowSnapshot struct {
	Rows      []sfRaceNowRow
	Schedule  *sfRaceNowSchedule
	Heartbeat *sfRaceNowHeartbeat
}

var (
	fetchSuperFormulaSnapshotFunc = fetchSuperFormulaRaceNowSnapshot
	superFormulaNowFunc           = func() time.Time { return time.Now().UTC() }

	superFormulaCacheMu   sync.RWMutex
	superFormulaCacheSnap *sfRaceNowSnapshot
	superFormulaCacheAt   time.Time
	superFormulaCacheErr  error
)

func cloneSuperFormulaSnapshot(snap *sfRaceNowSnapshot) *sfRaceNowSnapshot {
	if snap == nil {
		return nil
	}
	out := *snap
	out.Rows = append([]sfRaceNowRow(nil), snap.Rows...)
	if snap.Schedule != nil {
		s := *snap.Schedule
		out.Schedule = &s
	}
	if snap.Heartbeat != nil {
		h := *snap.Heartbeat
		out.Heartbeat = &h
	}
	return &out
}

func refreshSuperFormulaCache(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, superFormulaWSTimeout)
	defer cancel()
	snap, err := fetchSuperFormulaSnapshotFunc(ctx)
	superFormulaCacheMu.Lock()
	defer superFormulaCacheMu.Unlock()
	if err != nil {
		superFormulaCacheErr = err
		return
	}
	superFormulaCacheSnap = snap
	superFormulaCacheAt = time.Now()
	superFormulaCacheErr = nil
}

func superFormulaCacheFresh() bool {
	superFormulaCacheMu.RLock()
	defer superFormulaCacheMu.RUnlock()
	return superFormulaCacheSnap != nil && time.Since(superFormulaCacheAt) < superFormulaCacheTTL
}

func fetchSuperFormulaRaceNowSnapshotCached() (*sfRaceNowSnapshot, error) {
	superFormulaCacheMu.RLock()
	if superFormulaCacheSnap != nil {
		snap := cloneSuperFormulaSnapshot(superFormulaCacheSnap)
		superFormulaCacheMu.RUnlock()
		return snap, nil
	}
	err := superFormulaCacheErr
	superFormulaCacheMu.RUnlock()
	if err != nil {
		return nil, err
	}
	return nil, fmt.Errorf("no super formula snapshot yet")
}

// StartSuperFormulaCacheLoop refreshes the RaceNow websocket snapshot in the background.
func StartSuperFormulaCacheLoop(ctx context.Context) {
	refreshSuperFormulaCache(ctx)
	ticker := time.NewTicker(superFormulaCacheTTL)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				refreshSuperFormulaCache(ctx)
			}
		}
	}()
}

func ensureSuperFormulaCacheForSync() {
	if superFormulaCacheFresh() {
		return
	}
	refreshSuperFormulaCache(context.Background())
}

// findSuperFormulaLiveEvent maps a live session to the closest schedule row (exact date, then same weekend).
func findSuperFormulaLiveEvent(events []schedulefile.EventJSON, now time.Time) string {
	today := now.UTC().Format("2006-01-02")
	if id := findEventByDate(events, today, false); id != "" {
		return id
	}
	target, err := time.Parse("2006-01-02", today)
	if err != nil {
		return ""
	}
	var bestID string
	var bestDiff time.Duration = -1
	for _, e := range events {
		d := strings.TrimSpace(e.StartDate)
		if len(d) >= 10 {
			d = d[:10]
		}
		eventDay, err := time.Parse("2006-01-02", d)
		if err != nil {
			continue
		}
		diff := target.Sub(eventDay)
		if diff < 0 {
			diff = -diff
		}
		if diff > 3*24*time.Hour {
			continue
		}
		if bestDiff < 0 || diff < bestDiff {
			bestDiff = diff
			bestID = e.ID
		}
	}
	return bestID
}

func fetchSuperFormulaRaceNowSnapshot(ctx context.Context) (*sfRaceNowSnapshot, error) {
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.DialContext(ctx, superFormulaWSURL, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = conn.Close() }()

	snap := &sfRaceNowSnapshot{}
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(superFormulaWSTimeout)
	}

	for time.Now().Before(deadline) {
		if err := conn.SetReadDeadline(deadline); err != nil {
			break
		}
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		applySuperFormulaRaceNowMessage(snap, msg)
		if len(snap.Rows) > 0 && snap.Heartbeat != nil {
			return snap, nil
		}
	}
	if len(snap.Rows) == 0 && snap.Heartbeat == nil && snap.Schedule == nil {
		return nil, fmt.Errorf("no racenow data before timeout")
	}
	return snap, nil
}

func applySuperFormulaRaceNowMessage(snap *sfRaceNowSnapshot, msg []byte) {
	var envelope struct {
		Type string            `json:"type"`
		Rows []sfRaceNowRow    `json:"rows"`
		Raw  json.RawMessage   `json:"-"`
	}
	if err := json.Unmarshal(msg, &envelope); err != nil {
		return
	}
	switch strings.ToUpper(strings.TrimSpace(envelope.Type)) {
	case "0":
		if len(envelope.Rows) > 0 {
			snap.Rows = envelope.Rows
		}
	case "S":
		var sched sfRaceNowSchedule
		if json.Unmarshal(msg, &sched) == nil {
			snap.Schedule = &sched
		}
	case "F":
		var hb sfRaceNowHeartbeat
		if json.Unmarshal(msg, &hb) == nil {
			snap.Heartbeat = &hb
		}
	case "U", "1", "2", "3", "L":
		var row sfRaceNowRow
		if json.Unmarshal(msg, &row) == nil && strings.TrimSpace(row.CarNo) != "" {
			mergeSuperFormulaRow(snap, row)
		}
	}
}

func mergeSuperFormulaRow(snap *sfRaceNowSnapshot, row sfRaceNowRow) {
	for i := range snap.Rows {
		if snap.Rows[i].CarNo == row.CarNo {
			snap.Rows[i] = row
			return
		}
	}
	snap.Rows = append(snap.Rows, row)
}

func superFormulaSessionFinished(snap *sfRaceNowSnapshot) bool {
	if snap == nil || snap.Heartbeat == nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(snap.Heartbeat.Flag), "F")
}

func superFormulaSessionLooksLive(snap *sfRaceNowSnapshot) bool {
	if snap == nil {
		return false
	}
	if superFormulaSessionFinished(snap) {
		return false
	}
	for _, row := range snap.Rows {
		if strings.TrimSpace(row.RunFlag) == "1" && strings.TrimSpace(row.DriverE) != "" {
			return true
		}
	}
	return false
}

func superFormulaRowSortKey(row sfRaceNowRow) float64 {
	if strings.TrimSpace(row.RunFlag) != "1" {
		return -1e15 - float64(row.StartPos)
	}
	return float64(row.Laps)*1e7 - row.TotalTime
}

func superFormulaLeaderboardFrom(rows []sfRaceNowRow, raceMode string, limit int) []nascarLiveRunningEntry {
	sorted := append([]sfRaceNowRow(nil), rows...)
	sort.Slice(sorted, func(i, j int) bool {
		return superFormulaRowSortKey(sorted[i]) > superFormulaRowSortKey(sorted[j])
	})

	type ranked struct {
		row  sfRaceNowRow
		pos  int
		gap  string
	}
	rankedRows := make([]ranked, 0, len(sorted))
	var leaderTime float64
	var leaderLaps int
	pos := 0
	for _, row := range sorted {
		if strings.TrimSpace(row.RunFlag) != "1" || strings.TrimSpace(row.DriverE) == "" {
			continue
		}
		pos++
		gap := "—"
		if pos == 1 {
			leaderTime = row.TotalTime
			leaderLaps = row.Laps
		} else if strings.EqualFold(raceMode, "R") && row.Laps < leaderLaps {
			gap = fmt.Sprintf("+%d LAP", leaderLaps-row.Laps)
		} else if leaderTime > 0 && row.TotalTime > leaderTime {
			gap = "+" + strconv.FormatFloat(row.TotalTime-leaderTime, 'f', 3, 64)
		}
		rankedRows = append(rankedRows, ranked{row: row, pos: pos, gap: gap})
	}

	capacity := len(rankedRows)
	if limit > 0 && limit < capacity {
		capacity = limit
	}
	out := make([]nascarLiveRunningEntry, 0, capacity)
	for _, r := range rankedRows {
		row := r.row
		entry := nascarLiveRunningEntry{
			Position:         r.pos,
			CarNumber:        strings.TrimSpace(row.CarNo),
			Driver:           strings.TrimSpace(row.DriverE),
			Manufacturer:     superFormulaMakerLabel(row.Maker),
			StartingPosition: row.StartPos,
			LapsCompleted:    row.Laps,
			GapDisplay:       r.gap,
		}
		if team := strings.TrimSpace(row.TeamE); team != "" {
			if entry.Manufacturer != "" {
				entry.Manufacturer = team + " · " + entry.Manufacturer
			} else {
				entry.Manufacturer = team
			}
		}
		out = append(out, entry)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func superFormulaMakerLabel(code string) string {
	switch strings.ToLower(strings.TrimSpace(code)) {
	case "honda":
		return "Honda"
	case "toyota":
		return "Toyota"
	default:
		return strings.TrimSpace(code)
	}
}

func superFormulaRunName(snap *sfRaceNowSnapshot) string {
	if snap == nil || snap.Schedule == nil {
		return ""
	}
	parts := []string{
		strings.TrimSpace(snap.Schedule.Category),
		strings.TrimSpace(snap.Schedule.DescrJ),
	}
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " ")
}

func superFormulaRaceMode(snap *sfRaceNowSnapshot) string {
	if snap == nil || snap.Schedule == nil {
		return "R"
	}
	mode := strings.TrimSpace(snap.Schedule.RaceType)
	if mode == "" {
		return "R"
	}
	return mode
}

func superFormulaEventHasRaceResults(dataDir, eventID string) bool {
	if strings.TrimSpace(eventID) == "" {
		return false
	}
	detail, err := schedulefile.LoadEventDetail(dataDir, eventID)
	if err != nil || detail == nil || detail.Tables == nil {
		return false
	}
	if rr, ok := detail.Tables["race_results"]; ok && len(rr.Headers) > 0 && len(rr.Rows) > 0 {
		return true
	}
	return false
}

func superFormulaBoardFromSnapshot(snap *sfRaceNowSnapshot, dataDir string, limit int) (NASCARLiveBoard, error) {
	if snap == nil {
		return NASCARLiveBoard{Error: "no snapshot"}, fmt.Errorf("no snapshot")
	}
	raceMode := superFormulaRaceMode(snap)
	leaders := superFormulaLeaderboardFrom(snap.Rows, raceMode, limit)
	if len(leaders) == 0 {
		return NASCARLiveBoard{Error: "no leaders"}, fmt.Errorf("no leaders")
	}
	board := NASCARLiveBoard{
		SeriesKey:  superFormulaSeriesKey,
		SeriesName: superFormulaSeriesName,
		RunName:    superFormulaRunName(snap),
		Leaders:    leaders,
		FeedURL:    superFormulaLivePage,
	}
	if snap.Heartbeat != nil && strings.TrimSpace(snap.Heartbeat.Togo) != "" {
		if laps, err := strconv.Atoi(strings.Fields(snap.Heartbeat.Togo)[0]); err == nil && laps > 0 {
			if leaders[0].LapsCompleted > 0 {
				board.LapNumber = leaders[0].LapsCompleted
				board.LapsToGo = laps
				board.LapsInRace = board.LapNumber + board.LapsToGo
			}
		}
	}
	if board.LapNumber == 0 && leaders[0].LapsCompleted > 0 {
		board.LapNumber = leaders[0].LapsCompleted
	}
	if board.LapNumber > math.MaxInt32 {
		board.LapNumber = 0
	}

	events, err := schedulefile.LoadEvents(dataDir, "super_formula")
	if err == nil && len(events) > 0 {
		board.EventID = findSuperFormulaLiveEvent(events, superFormulaNowFunc())
	}
	if board.EventID != "" && strings.Contains(strings.ToLower(board.RunName), "race") && superFormulaEventHasRaceResults(dataDir, board.EventID) {
		return NASCARLiveBoard{Error: "race results published"}, fmt.Errorf("race results published")
	}
	return board, nil
}

// CollectSuperFormulaLiveBoards returns a Super Formula leaderboard when RaceNow websocket is active.
func CollectSuperFormulaLiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	snap, err := fetchSuperFormulaRaceNowSnapshotCached()
	if err != nil || !superFormulaSessionLooksLive(snap) {
		return nil
	}
	board, err := superFormulaBoardFromSnapshot(snap, dataDir, leaderLimit)
	if err != nil || len(board.Leaders) == 0 {
		return nil
	}
	return []NASCARLiveBoard{board}
}

// SyncSuperFormula updates Super Formula entries in live.json from the RaceNow websocket feed.
func SyncSuperFormula(dataDir string) error {
	ensureSuperFormulaCacheForSync()
	livePath := filepath.Join(dataDir, "live.json")
	snap, err := fetchSuperFormulaRaceNowSnapshotCached()
	if err != nil {
		livesyncErrorsTotal.WithLabelValues("super_formula", "live_feed").Inc()
		return mergeLiveJSONSuperFormula(livePath, nil)
	}
	if !superFormulaSessionLooksLive(snap) {
		livesyncErrorsTotal.WithLabelValues("super_formula", "no_live_window").Inc()
		return mergeLiveJSONSuperFormula(livePath, nil)
	}
	events, err := schedulefile.LoadEvents(dataDir, "super_formula")
	if err != nil || len(events) == 0 {
		livesyncErrorsTotal.WithLabelValues("super_formula", "no_events").Inc()
		return mergeLiveJSONSuperFormula(livePath, nil)
	}
	today := superFormulaNowFunc()
	eventID := findSuperFormulaLiveEvent(events, today)
	if eventID == "" {
		livesyncErrorsTotal.WithLabelValues("super_formula", "no_matching_event").Inc()
		return mergeLiveJSONSuperFormula(livePath, nil)
	}
	if err := mergeLiveJSONSuperFormula(livePath, []string{eventID}); err != nil {
		livesyncErrorsTotal.WithLabelValues("super_formula", "write_live_json").Inc()
		return err
	}
	livesyncLastSuccess.WithLabelValues("super_formula").Set(float64(time.Now().Unix()))
	return nil
}
