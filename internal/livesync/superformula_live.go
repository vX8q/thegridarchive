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
	superFormulaWSURL      = "ws://superformula.racelive.jp:6001/get"
	superFormulaLivePage   = "http://superformula.racelive.jp/live"
	superFormulaSeriesKey  = "SUPER_FORMULA"
	superFormulaSeriesName = "Super Formula"
	superFormulaWSTimeout  = 8 * time.Second
	superFormulaCacheTTL   = 30 * time.Second
	// RaceNow keeps serving the final classification long after a session ends,
	// so a snapshot whose timing has not moved for this long is treated as over.
	superFormulaStaleAfter = 15 * time.Minute
	// Once timing rows arrive, stop waiting for the optional heartbeat message.
	superFormulaRowsGrace = 2 * time.Second
)

// sfRaceNowRow mirrors a RaceNow timing row. The feed sends every numeric
// field as a JSON string, so numbers use the flexible decoders.
type sfRaceNowRow struct {
	CarNo     string        `json:"CARNO"`
	DriverE   string        `json:"DRIVER_E"`
	TeamE     string        `json:"TEAM_E"`
	Laps      flexJSONInt   `json:"LAPS"`
	TotalTime flexJSONFloat `json:"TOTAL_TIME"`
	StartPos  flexJSONInt   `json:"START_POS"`
	RunFlag   string        `json:"RUN_FLAG"`
	Maker     string        `json:"MAKER"`
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

	superFormulaCacheMu     sync.RWMutex
	superFormulaCacheSnap   *sfRaceNowSnapshot
	superFormulaCacheAt     time.Time
	superFormulaCacheErr    error
	superFormulaTimingPrint string
	superFormulaTimingMoved time.Time
)

// superFormulaTimingFingerprint captures the parts of a snapshot that change
// while cars are on track.
func superFormulaTimingFingerprint(snap *sfRaceNowSnapshot) string {
	if snap == nil {
		return ""
	}
	var b strings.Builder
	if snap.Heartbeat != nil {
		b.WriteString(snap.Heartbeat.Flag)
		b.WriteByte('|')
		b.WriteString(snap.Heartbeat.Togo)
		b.WriteByte(';')
	}
	for _, row := range snap.Rows {
		b.WriteString(row.CarNo)
		b.WriteByte(':')
		b.WriteString(strconv.Itoa(row.Laps.Int()))
		b.WriteByte(':')
		b.WriteString(strconv.FormatFloat(row.TotalTime.Float(), 'f', 3, 64))
		b.WriteByte(';')
	}
	return b.String()
}

// superFormulaTimingStalled reports whether the feed has been serving identical
// timing for longer than superFormulaStaleAfter (finished session left on air).
func superFormulaTimingStalled() bool {
	superFormulaCacheMu.RLock()
	defer superFormulaCacheMu.RUnlock()
	if superFormulaTimingMoved.IsZero() {
		return false
	}
	return time.Since(superFormulaTimingMoved) > superFormulaStaleAfter
}

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
	now := time.Now()
	if fp := superFormulaTimingFingerprint(snap); fp != superFormulaTimingPrint {
		superFormulaTimingPrint = fp
		superFormulaTimingMoved = now
	}
	superFormulaCacheSnap = snap
	superFormulaCacheAt = now
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
		readUntil := deadline
		if len(snap.Rows) > 0 {
			if grace := time.Now().Add(superFormulaRowsGrace); grace.Before(readUntil) {
				readUntil = grace
			}
		}
		if err := conn.SetReadDeadline(readUntil); err != nil {
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
		Type string         `json:"type"`
		Rows []sfRaceNowRow `json:"rows"`
	}
	if err := json.Unmarshal(msg, &envelope); err != nil && envelope.Type == "" {
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

// superFormulaSnapshotIsLive combines the session state with feed freshness.
func superFormulaSnapshotIsLive(snap *sfRaceNowSnapshot) bool {
	return superFormulaSessionLooksLive(snap) && !superFormulaTimingStalled()
}

func superFormulaRowSortKey(row sfRaceNowRow) float64 {
	if strings.TrimSpace(row.RunFlag) != "1" {
		return -1e15 - float64(row.StartPos.Int())
	}
	return float64(row.Laps.Int())*1e7 - row.TotalTime.Float()
}

func superFormulaLeaderboardFrom(rows []sfRaceNowRow, raceMode string, limit int) []nascarLiveRunningEntry {
	sorted := append([]sfRaceNowRow(nil), rows...)
	sort.Slice(sorted, func(i, j int) bool {
		return superFormulaRowSortKey(sorted[i]) > superFormulaRowSortKey(sorted[j])
	})

	type ranked struct {
		row sfRaceNowRow
		pos int
		gap string
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
		switch {
		case pos == 1:
			leaderTime = row.TotalTime.Float()
			leaderLaps = row.Laps.Int()
		case strings.EqualFold(raceMode, "R") && row.Laps.Int() < leaderLaps:
			gap = fmt.Sprintf("+%d LAP", leaderLaps-row.Laps.Int())
		case leaderTime > 0 && row.TotalTime.Float() > leaderTime:
			gap = "+" + strconv.FormatFloat(row.TotalTime.Float()-leaderTime, 'f', 3, 64)
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
			StartingPosition: row.StartPos.Int(),
			LapsCompleted:    row.Laps.Int(),
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
		if board.EventID == "" {
			// RaceNow stays online between rounds; without a scheduled event
			// nearby the payload is last weekend's classification.
			return NASCARLiveBoard{Error: "no scheduled event"}, fmt.Errorf("no scheduled super formula event")
		}
	}
	if board.EventID != "" && strings.Contains(strings.ToLower(board.RunName), "race") && superFormulaEventHasRaceResults(dataDir, board.EventID) {
		return NASCARLiveBoard{Error: "race results published"}, fmt.Errorf("race results published")
	}
	return board, nil
}

// CollectSuperFormulaLiveBoards returns a Super Formula leaderboard when RaceNow websocket is active.
func CollectSuperFormulaLiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	snap, err := fetchSuperFormulaRaceNowSnapshotCached()
	if err != nil || !superFormulaSnapshotIsLive(snap) {
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
	if !superFormulaSnapshotIsLive(snap) {
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
