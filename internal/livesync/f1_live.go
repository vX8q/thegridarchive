package livesync

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/vX8q/tga/internal/schedulefile"
)

const (
	f1SeriesKey  = "F1"
	f1SeriesName = "Formula 1"
)

// openF1SessionFull is a session row from api.openf1.org/v1/sessions.
type openF1SessionFull struct {
	SessionKey       int    `json:"session_key"`
	SessionType      string `json:"session_type"`
	SessionName      string `json:"session_name"`
	DateStart        string `json:"date_start"`
	DateEnd          string `json:"date_end"`
	MeetingKey       int    `json:"meeting_key"`
	CircuitShortName string `json:"circuit_short_name"`
	Location         string `json:"location"`
	CountryName      string `json:"country_name"`
	Year             int    `json:"year"`
	IsCancelled      bool   `json:"is_cancelled"`
}

type openF1Driver struct {
	DriverNumber  int    `json:"driver_number"`
	BroadcastName string `json:"broadcast_name"`
	FullName      string `json:"full_name"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	TeamName      string `json:"team_name"`
	TeamColour    string `json:"team_colour"`
}

type openF1PositionRow struct {
	Date         string `json:"date"`
	DriverNumber int    `json:"driver_number"`
	Position     int    `json:"position"`
	SessionKey   int    `json:"session_key"`
}

type openF1IntervalRow struct {
	Date         string          `json:"date"`
	DriverNumber int             `json:"driver_number"`
	GapToLeader  json.RawMessage `json:"gap_to_leader"`
	SessionKey   int             `json:"session_key"`
}

type openF1StartingGridRow struct {
	DriverNumber int `json:"driver_number"`
	Position     int `json:"position"`
	SessionKey   int `json:"session_key"`
}

type openF1LapRow struct {
	DriverNumber int `json:"driver_number"`
	LapNumber    int `json:"lap_number"`
	SessionKey   int `json:"session_key"`
}

var (
	fetchOpenF1LatestMeetingSessionsFunc = fetchOpenF1LatestMeetingSessions
	fetchOpenF1SessionsLatestRawFunc     = fetchOpenF1SessionsLatestRaw
	fetchOpenF1DriversFunc               = fetchOpenF1Drivers
	fetchOpenF1PositionsFunc             = fetchOpenF1Positions
	fetchOpenF1IntervalsFunc           = fetchOpenF1Intervals
	fetchOpenF1IntervalsForDriverFunc  = fetchOpenF1IntervalsForDriver
	fetchOpenF1StartingGridFunc        = fetchOpenF1StartingGrid
	fetchOpenF1LapsFunc                  = fetchOpenF1Laps
	openF1NowFunc                        = func() time.Time { return time.Now().UTC() }
)

func parseOpenF1Time(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty openf1 time")
	}
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02T15:04:05.999999Z07:00",
		time.RFC3339,
	}
	var lastErr error
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t.UTC(), nil
		} else {
			lastErr = err
		}
	}
	if lastErr != nil {
		return time.Time{}, lastErr
	}
	return time.Time{}, fmt.Errorf("parse openf1 time %q", s)
}

func openF1SessionInLiveWindow(session *openF1SessionFull, now time.Time) bool {
	if session == nil || session.IsCancelled {
		return false
	}
	start, err1 := parseOpenF1Time(session.DateStart)
	end, err2 := parseOpenF1Time(session.DateEnd)
	if err1 != nil || err2 != nil {
		return false
	}
	return !now.Before(start) && !now.After(end)
}

func openF1SessionTypePriority(sessionType string) int {
	switch strings.TrimSpace(sessionType) {
	case "Race":
		return 3
	case "Qualifying":
		return 2
	case "Practice":
		return 1
	default:
		return 0
	}
}

// pickOpenF1LiveSession returns the highest-priority session in progress at now.
func pickOpenF1LiveSession(sessions []openF1SessionFull, now time.Time) *openF1SessionFull {
	var best *openF1SessionFull
	bestPri := -1
	for i := range sessions {
		s := &sessions[i]
		if !openF1SessionInLiveWindow(s, now) {
			continue
		}
		pri := openF1SessionTypePriority(s.SessionType)
		if pri > bestPri {
			best = s
			bestPri = pri
		}
	}
	return best
}

func findOpenF1LiveSessionAt(now time.Time) (*openF1SessionFull, error) {
	sessions, err := fetchOpenF1LatestMeetingSessionsFunc()
	if err != nil {
		return nil, err
	}
	if session := pickOpenF1LiveSession(sessions, now); session != nil {
		return session, nil
	}
	// Fallback: session_key=latest when API marks it as the current session.
	latest, err := fetchOpenF1SessionsLatestRawFunc()
	if err != nil || len(latest) == 0 {
		return nil, err
	}
	if openF1SessionInLiveWindow(&latest[0], now) {
		return &latest[0], nil
	}
	return nil, nil
}

func fetchOpenF1LatestMeetingSessions() ([]openF1SessionFull, error) {
	var out []openF1SessionFull
	if err := livesyncGetJSON(openF1Base+"/v1/sessions?meeting_key=latest", &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1SessionsLatestRaw() ([]openF1SessionFull, error) {
	var out []openF1SessionFull
	if err := livesyncGetJSON(openF1Base+"/v1/sessions?session_key=latest", &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1Drivers(sessionKey int) ([]openF1Driver, error) {
	var out []openF1Driver
	url := fmt.Sprintf("%s/v1/drivers?session_key=%d", openF1Base, sessionKey)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1Positions(sessionKey int) ([]openF1PositionRow, error) {
	var out []openF1PositionRow
	url := fmt.Sprintf("%s/v1/position?session_key=%d", openF1Base, sessionKey)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1Intervals(sessionKey int) ([]openF1IntervalRow, error) {
	var out []openF1IntervalRow
	url := fmt.Sprintf("%s/v1/intervals?session_key=%d", openF1Base, sessionKey)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1IntervalsForDriver(sessionKey, driverNumber int) ([]openF1IntervalRow, error) {
	var out []openF1IntervalRow
	url := fmt.Sprintf("%s/v1/intervals?session_key=%d&driver_number=%d", openF1Base, sessionKey, driverNumber)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1StartingGrid(sessionKey int) ([]openF1StartingGridRow, error) {
	var out []openF1StartingGridRow
	url := fmt.Sprintf("%s/v1/starting_grid?session_key=%d", openF1Base, sessionKey)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchOpenF1Laps(sessionKey, driverNumber int) ([]openF1LapRow, error) {
	var out []openF1LapRow
	url := fmt.Sprintf("%s/v1/laps?session_key=%d&driver_number=%d", openF1Base, sessionKey, driverNumber)
	if err := livesyncGetJSON(url, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func latestOpenF1PositionByDriver(rows []openF1PositionRow) map[int]openF1PositionRow {
	out := make(map[int]openF1PositionRow)
	for _, row := range rows {
		if row.DriverNumber <= 0 || row.Position <= 0 {
			continue
		}
		ts, err := parseOpenF1Time(row.Date)
		if err != nil {
			continue
		}
		prev, ok := out[row.DriverNumber]
		if !ok {
			out[row.DriverNumber] = row
			continue
		}
		prevTS, err := parseOpenF1Time(prev.Date)
		if err != nil || ts.After(prevTS) {
			out[row.DriverNumber] = row
		}
	}
	return out
}

func earliestOpenF1PositionByDriver(rows []openF1PositionRow) map[int]int {
	out := make(map[int]int)
	bestTS := make(map[int]time.Time)
	for _, row := range rows {
		if row.DriverNumber <= 0 || row.Position <= 0 {
			continue
		}
		ts, err := parseOpenF1Time(row.Date)
		if err != nil {
			continue
		}
		prev, ok := bestTS[row.DriverNumber]
		if !ok || ts.Before(prev) {
			bestTS[row.DriverNumber] = ts
			out[row.DriverNumber] = row.Position
		}
	}
	return out
}

func latestOpenF1GapByDriver(rows []openF1IntervalRow) map[int]string {
	type gapEntry struct {
		ts  time.Time
		gap string
	}
	best := make(map[int]gapEntry)
	for _, row := range rows {
		if row.DriverNumber <= 0 {
			continue
		}
		ts, err := parseOpenF1Time(row.Date)
		if err != nil {
			continue
		}
		gap := formatOpenF1GapRaw(row.GapToLeader)
		prev, ok := best[row.DriverNumber]
		if !ok || ts.After(prev.ts) {
			best[row.DriverNumber] = gapEntry{ts: ts, gap: gap}
		}
	}
	out := make(map[int]string, len(best))
	for dn, entry := range best {
		out[dn] = entry.gap
	}
	return out
}

func formatOpenF1GapRaw(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		s = strings.TrimSpace(s)
		if s == "" || strings.EqualFold(s, "null") {
			return ""
		}
		upper := strings.ToUpper(s)
		if strings.Contains(upper, "LAP") {
			if strings.HasPrefix(upper, "+") {
				return s
			}
			return "+" + s
		}
		if f, err := strconv.ParseFloat(s, 64); err == nil && f > 0 {
			return formatOpenF1GapSeconds(f)
		}
		return "+" + s
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err == nil && n > 0 {
		return formatOpenF1GapSeconds(n)
	}
	return ""
}

func formatOpenF1GapSeconds(n float64) string {
	s := strconv.FormatFloat(n, 'f', 3, 64)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	return "+" + s + "s"
}

func openF1DriverDisplayName(d openF1Driver) string {
	if strings.TrimSpace(d.FirstName) != "" && strings.TrimSpace(d.LastName) != "" {
		return strings.TrimSpace(d.FirstName + " " + d.LastName)
	}
	if name := strings.TrimSpace(d.FullName); name != "" {
		return openF1TitleName(name)
	}
	return strings.TrimSpace(d.BroadcastName)
}

func openF1TitleName(name string) string {
	parts := strings.Fields(name)
	for i, p := range parts {
		if len(p) <= 1 {
			parts[i] = strings.ToUpper(p)
			continue
		}
		parts[i] = strings.ToUpper(p[:1]) + strings.ToLower(p[1:])
	}
	return strings.Join(parts, " ")
}

func openF1DriversMap(drivers []openF1Driver) map[int]openF1Driver {
	out := make(map[int]openF1Driver, len(drivers))
	for _, d := range drivers {
		if d.DriverNumber > 0 {
			out[d.DriverNumber] = d
		}
	}
	return out
}

func openF1StartingGridMap(rows []openF1StartingGridRow) map[int]int {
	out := make(map[int]int, len(rows))
	for _, row := range rows {
		if row.DriverNumber > 0 && row.Position > 0 {
			out[row.DriverNumber] = row.Position
		}
	}
	return out
}

func f1LeaderboardFrom(
	session *openF1SessionFull,
	positions map[int]openF1PositionRow,
	drivers map[int]openF1Driver,
	grid map[int]int,
	gaps map[int]string,
	limit int,
) []nascarLiveRunningEntry {
	type row struct {
		pos int
		dn  int
	}
	rows := make([]row, 0, len(positions))
	for dn, pos := range positions {
		rows = append(rows, row{pos: pos.Position, dn: dn})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].pos != rows[j].pos {
			return rows[i].pos < rows[j].pos
		}
		return rows[i].dn < rows[j].dn
	})
	capacity := len(rows)
	if limit > 0 && limit < capacity {
		capacity = limit
	}
	out := make([]nascarLiveRunningEntry, 0, capacity)
	for _, r := range rows {
		d, ok := drivers[r.dn]
		if !ok {
			continue
		}
		name := openF1DriverDisplayName(d)
		if name == "" {
			continue
		}
		entry := nascarLiveRunningEntry{
			Position:   r.pos,
			CarNumber:  strconv.Itoa(r.dn),
			Driver:     name,
			Manufacturer: strings.TrimSpace(d.TeamName),
		}
		if gp, ok := grid[r.dn]; ok && gp > 0 {
			entry.StartingPosition = gp
		}
		if session != nil && strings.EqualFold(session.SessionType, "Race") {
			if gap, ok := gaps[r.dn]; ok && gap != "" {
				entry.GapDisplay = gap
			} else if r.pos == 1 {
				entry.GapDisplay = "—"
			}
		}
		out = append(out, entry)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func openF1DriverNumbersForGaps(latestPos map[int]openF1PositionRow, limit int) []int {
	type row struct {
		pos int
		dn  int
	}
	rows := make([]row, 0, len(latestPos))
	for dn, pos := range latestPos {
		if dn <= 0 || pos.Position <= 0 {
			continue
		}
		rows = append(rows, row{pos: pos.Position, dn: dn})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].pos != rows[j].pos {
			return rows[i].pos < rows[j].pos
		}
		return rows[i].dn < rows[j].dn
	})
	capacity := len(rows)
	if limit > 0 && limit < capacity {
		capacity = limit
	}
	out := make([]int, 0, capacity)
	for _, r := range rows {
		out = append(out, r.dn)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func latestOpenF1GapsForDrivers(sessionKey int, driverNumbers []int) map[int]string {
	out := make(map[int]string, len(driverNumbers))
	for _, dn := range driverNumbers {
		if dn <= 0 {
			continue
		}
		rows, err := fetchOpenF1IntervalsForDriverFunc(sessionKey, dn)
		if err != nil || len(rows) == 0 {
			continue
		}
		if gap, ok := latestOpenF1GapByDriver(rows)[dn]; ok && gap != "" {
			out[dn] = gap
		}
	}
	return out
}

const f1LapCacheTTL = 45 * time.Second

type f1LapCacheEntry struct {
	lap int
	at  time.Time
}

var (
	f1LapCacheMu sync.RWMutex
	f1LapCache   = make(map[string]f1LapCacheEntry)
)

func f1LapCacheKey(sessionKey, driverNumber int) string {
	return strconv.Itoa(sessionKey) + ":" + strconv.Itoa(driverNumber)
}

func f1MaxLapForDriver(sessionKey, driverNumber int) int {
	key := f1LapCacheKey(sessionKey, driverNumber)
	f1LapCacheMu.RLock()
	if ent, ok := f1LapCache[key]; ok && time.Since(ent.at) < f1LapCacheTTL {
		lap := ent.lap
		f1LapCacheMu.RUnlock()
		return lap
	}
	f1LapCacheMu.RUnlock()

	laps, err := fetchOpenF1LapsFunc(sessionKey, driverNumber)
	if err != nil || len(laps) == 0 {
		return 0
	}
	maxLap := 0
	for _, lap := range laps {
		if lap.LapNumber > maxLap {
			maxLap = lap.LapNumber
		}
	}
	f1LapCacheMu.Lock()
	f1LapCache[key] = f1LapCacheEntry{lap: maxLap, at: time.Now()}
	f1LapCacheMu.Unlock()
	return maxLap
}

func f1EventHasRaceResults(dataDir, eventID string) bool {
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

func f1BoardFromSession(session *openF1SessionFull, dataDir string, limit int) (NASCARLiveBoard, error) {
	if session == nil {
		return NASCARLiveBoard{Error: "no session"}, fmt.Errorf("no session")
	}
	positions, err := fetchOpenF1PositionsFunc(session.SessionKey)
	if err != nil {
		return NASCARLiveBoard{Error: err.Error()}, err
	}
	latestPos := latestOpenF1PositionByDriver(positions)
	if len(latestPos) == 0 {
		return NASCARLiveBoard{Error: "no positions"}, fmt.Errorf("no positions")
	}

	drivers, err := fetchOpenF1DriversFunc(session.SessionKey)
	if err != nil {
		return NASCARLiveBoard{Error: err.Error()}, err
	}
	driverMap := openF1DriversMap(drivers)

	grid := openF1StartingGridMap(nil)
	if gridRows, err := fetchOpenF1StartingGridFunc(session.SessionKey); err == nil && len(gridRows) > 0 {
		grid = openF1StartingGridMap(gridRows)
	} else {
		grid = earliestOpenF1PositionByDriver(positions)
	}

	gaps := map[int]string{}
	if strings.EqualFold(session.SessionType, "Race") {
		gapLimit := limit
		if gapLimit <= 0 {
			gapLimit = LiveBoardLeaderLimit
		}
		driverNums := openF1DriverNumbersForGaps(latestPos, gapLimit)
		gaps = latestOpenF1GapsForDrivers(session.SessionKey, driverNums)
	}

	leaders := f1LeaderboardFrom(session, latestPos, driverMap, grid, gaps, limit)
	if len(leaders) == 0 {
		return NASCARLiveBoard{Error: "no leaders"}, fmt.Errorf("no leaders")
	}

	board := NASCARLiveBoard{
		SeriesID:   session.SessionKey,
		SeriesKey:  f1SeriesKey,
		SeriesName: f1SeriesName,
		RaceID:     session.SessionKey,
		TrackName:  strings.TrimSpace(session.CircuitShortName),
		RunName:    strings.TrimSpace(session.SessionName),
		Leaders:    leaders,
		FeedURL:    fmt.Sprintf("%s/v1/sessions?session_key=%d", openF1Base, session.SessionKey),
	}

	events, err := schedulefile.LoadEvents(dataDir, "f1")
	if err == nil && len(events) > 0 {
		board.EventID = findEventByDate(events, session.DateStart, true)
	}
	if board.EventID != "" && strings.EqualFold(session.SessionType, "Race") && f1EventHasRaceResults(dataDir, board.EventID) {
		return NASCARLiveBoard{Error: "race results published"}, fmt.Errorf("race results published")
	}

	if leaderDN := leaders[0].CarNumber; leaderDN != "" {
		if dn, err := strconv.Atoi(leaderDN); err == nil && dn > 0 {
			board.LapNumber = f1MaxLapForDriver(session.SessionKey, dn)
		}
	}
	if board.LapNumber < 0 {
		board.LapNumber = 0
	}
	if board.LapNumber > math.MaxInt32 {
		board.LapNumber = 0
	}

	return board, nil
}

// CollectF1LiveBoards returns a live leaderboard when an OpenF1 session is in progress.
func CollectF1LiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	session, err := findOpenF1LiveSessionAt(openF1NowFunc())
	if err != nil || session == nil {
		return nil
	}
	board, err := f1BoardFromSession(session, dataDir, leaderLimit)
	if err != nil || len(board.Leaders) == 0 {
		return nil
	}
	return []NASCARLiveBoard{board}
}

// CollectLiveBoards returns live leaderboards for all integrated series.
func CollectLiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	boards := CollectNASCARLiveBoards(dataDir, leaderLimit)
	if f1Boards := CollectF1LiveBoards(dataDir, leaderLimit); len(f1Boards) > 0 {
		boards = append(boards, f1Boards...)
	}
	if wecBoards := CollectWECLiveBoards(dataDir, leaderLimit); len(wecBoards) > 0 {
		boards = append(boards, wecBoards...)
	}
	if sfBoards := CollectSuperFormulaLiveBoards(dataDir, leaderLimit); len(sfBoards) > 0 {
		boards = append(boards, sfBoards...)
	}
	return boards
}
