package livesync

import (
	"fmt"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

var nascarNowFunc = func() time.Time { return time.Now() }

type nascarLiveFeed struct {
	RaceID   int `json:"race_id"`
	SeriesID int `json:"series_id"`
}

type nascarCFLiveFeedJSON struct {
	RaceID     int               `json:"race_id"`
	SeriesID   int               `json:"series_id"`
	RunName    string            `json:"run_name"`
	TrackName  string            `json:"track_name"`
	LapNumber  int               `json:"lap_number"`
	LapsInRace int               `json:"laps_in_race"`
	LapsToGo   int               `json:"laps_to_go"`
	FlagState  int               `json:"flag_state"`
	Vehicles   []nascarCFVehicle `json:"vehicles"`
}

type nascarCFVehicle struct {
	VehicleNumber     string  `json:"vehicle_number"`
	VehicleManufacturer string `json:"vehicle_manufacturer"`
	RunningPosition   int     `json:"running_position"`
	StartingPosition  int     `json:"starting_position"`
	LapsCompleted     int     `json:"laps_completed"`
	Delta             float64 `json:"delta"`
	Driver            nascarCFDriver `json:"driver"`
}

type nascarLiveRaceSummary struct {
	RaceID     int    `json:"race_id"`
	SeriesID   int    `json:"series_id"`
	RunName    string `json:"run_name,omitempty"`
	TrackName  string `json:"track_name,omitempty"`
	LapNumber  int    `json:"lap_number,omitempty"`
	LapsInRace int    `json:"laps_in_race,omitempty"`
	LapsToGo   int    `json:"laps_to_go,omitempty"`
	FlagState  int    `json:"flag_state,omitempty"`
}

type nascarLiveRunningEntry struct {
	Position         int     `json:"position"`
	CarNumber        string  `json:"car_number"`
	Driver           string  `json:"driver"`
	Manufacturer     string  `json:"manufacturer,omitempty"`
	StartingPosition int     `json:"starting_position,omitempty"`
	LapsCompleted    int     `json:"laps_completed,omitempty"`
	GapSeconds       float64 `json:"gap_seconds,omitempty"`
	GapDisplay       string  `json:"gap_display,omitempty"`
}

// NASCARLiveBoard is a formatted live leaderboard for one NASCAR series.
type NASCARLiveBoard struct {
	SeriesID   int                      `json:"series_id"`
	SeriesKey  string                   `json:"series_key"`
	SeriesName string                   `json:"series_name"`
	EventID    string                   `json:"event_id,omitempty"`
	RaceID     int                      `json:"race_id"`
	TrackName  string                   `json:"track_name,omitempty"`
	RunName    string                   `json:"run_name,omitempty"`
	LapNumber  int                      `json:"lap_number,omitempty"`
	LapsInRace int                      `json:"laps_in_race,omitempty"`
	LapsToGo   int                      `json:"laps_to_go,omitempty"`
	FlagState  int                      `json:"flag_state,omitempty"`
	Leaders    []nascarLiveRunningEntry `json:"leaders,omitempty"`
	FeedURL    string                   `json:"feed_url,omitempty"`
	Error      string                   `json:"error,omitempty"`
}

var nascarSeriesMeta = map[int]struct {
	DataID    string
	SeriesKey string
	Name      string
}{
	1: {DataID: "nascar_cup", SeriesKey: "NASCAR_CUP", Name: "NASCAR Cup Series"},
	2: {DataID: "noaps", SeriesKey: "NOAPS", Name: "O'Reilly Auto Parts Series"},
	3: {DataID: "nascar_truck", SeriesKey: "NASCAR_TRUCK", Name: "NASCAR Craftsman Truck Series"},
}

var nascarLivePrefixBySeries = map[int]string{
	1: "NASCAR_CUP",
	2: "NOAPS",
	3: "NASCAR_TRUCK",
}

func nascarSeriesLiveFeedURL(seriesID, raceID int) string {
	return fmt.Sprintf("%s/live/feeds/series_%d/%d/live_feed.json", nascarCFBase, seriesID, raceID)
}

func fetchNASCARLiveFeedFull() (*nascarCFLiveFeedJSON, error) {
	var out nascarCFLiveFeedJSON
	if err := livesyncGetJSON(nascarCFLiveFeed, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func fetchNASCARSeriesLiveFeed(seriesID, raceID int) (*nascarCFLiveFeedJSON, error) {
	var out nascarCFLiveFeedJSON
	if err := livesyncGetJSON(nascarSeriesLiveFeedURL(seriesID, raceID), &out); err != nil {
		return nil, err
	}
	if out.RaceID == 0 {
		return nil, fmt.Errorf("empty live feed for series %d race %d", seriesID, raceID)
	}
	return &out, nil
}

func nascarManufacturerLabel(code string) string {
	switch strings.ToLower(strings.TrimSpace(code)) {
	case "tyt":
		return "Toyota"
	case "chv":
		return "Chevrolet"
	case "frd":
		return "Ford"
	default:
		if code == "" {
			return ""
		}
		return code
	}
}

func nascarLiveRaceSummaryFrom(feed *nascarCFLiveFeedJSON) *nascarLiveRaceSummary {
	if feed == nil || feed.RaceID == 0 {
		return nil
	}
	return &nascarLiveRaceSummary{
		RaceID:     feed.RaceID,
		SeriesID:   feed.SeriesID,
		RunName:    feed.RunName,
		TrackName:  feed.TrackName,
		LapNumber:  feed.LapNumber,
		LapsInRace: feed.LapsInRace,
		LapsToGo:   feed.LapsToGo,
		FlagState:  feed.FlagState,
	}
}

func nascarLiveLeaderboardFrom(feed *nascarCFLiveFeedJSON, limit int) []nascarLiveRunningEntry {
	if feed == nil || len(feed.Vehicles) == 0 {
		return nil
	}
	vehicles := append([]nascarCFVehicle(nil), feed.Vehicles...)
	sort.Slice(vehicles, func(i, j int) bool {
		pi, pj := vehicles[i].RunningPosition, vehicles[j].RunningPosition
		if pi == 0 {
			return false
		}
		if pj == 0 {
			return true
		}
		return pi < pj
	})
	capacity := len(vehicles)
	if limit > 0 && limit < capacity {
		capacity = limit
	}
	out := make([]nascarLiveRunningEntry, 0, capacity)
	for _, v := range vehicles {
		if v.RunningPosition <= 0 {
			continue
		}
		driverName := nascarDriverDisplayName(v.Driver)
		if driverName == "" {
			continue
		}
		out = append(out, nascarLiveRunningEntry{
			Position:         v.RunningPosition,
			CarNumber:        v.VehicleNumber,
			Driver:           driverName,
			Manufacturer:     nascarManufacturerLabel(v.VehicleManufacturer),
			StartingPosition: v.StartingPosition,
			LapsCompleted:    v.LapsCompleted,
			GapSeconds:       v.Delta,
		})
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func nascarBoardFromFeed(feed *nascarCFLiveFeedJSON, dataDir string, limit int) NASCARLiveBoard {
	meta, ok := nascarSeriesMeta[feed.SeriesID]
	if !ok {
		return NASCARLiveBoard{Error: fmt.Sprintf("unknown series_id %d", feed.SeriesID)}
	}
	board := NASCARLiveBoard{
		SeriesID:   feed.SeriesID,
		SeriesKey:  meta.SeriesKey,
		SeriesName: meta.Name,
		RaceID:     feed.RaceID,
		TrackName:  feed.TrackName,
		RunName:    feed.RunName,
		LapNumber:  feed.LapNumber,
		LapsInRace: feed.LapsInRace,
		LapsToGo:   feed.LapsToGo,
		FlagState:  feed.FlagState,
		Leaders:    nascarLiveLeaderboardFrom(feed, limit),
		FeedURL:    nascarSeriesLiveFeedURL(feed.SeriesID, feed.RaceID),
	}
	season, _ := strconv.Atoi(config.CurrentSeason)
	races, err := fetchNASCARRacesFunc(feed.SeriesID, season)
	if err == nil {
		raceDate := make(map[int]string)
		for _, r := range races {
			if r.RaceID != 0 && r.DateScheduled != "" {
				raceDate[r.RaceID] = dateOnly(r.DateScheduled)
			}
		}
		if schedDate, ok := raceDate[feed.RaceID]; ok {
			events, evErr := schedulefile.LoadEvents(dataDir, meta.DataID)
			if evErr == nil && len(events) > 0 {
				board.EventID = findEventByDate(events, schedDate, false)
			}
		}
	}
	return board
}

func nascarRaceFromList(races []nascarRace, raceID int) *nascarRace {
	for _, r := range races {
		if r.RaceID == raceID {
			copy := r
			return &copy
		}
	}
	return nil
}

func nascarRaceIDForLiveEvent(dataDir string, seriesID int, eventID string) (int, error) {
	meta, ok := nascarSeriesMeta[seriesID]
	if !ok {
		return 0, fmt.Errorf("unknown series_id %d", seriesID)
	}
	events, err := schedulefile.LoadEvents(dataDir, meta.DataID)
	if err != nil {
		return 0, err
	}
	var eventDate string
	for _, e := range events {
		if strings.EqualFold(e.ID, eventID) {
			eventDate = dateOnly(e.StartDate)
			break
		}
	}
	if eventDate == "" {
		return 0, fmt.Errorf("event %s not found in %s schedule", eventID, meta.DataID)
	}
	season, _ := strconv.Atoi(config.CurrentSeason)
	races, err := fetchNASCARRacesFunc(seriesID, season)
	if err != nil {
		return 0, err
	}
	for _, r := range races {
		if r.RaceID != 0 && dateOnly(r.DateScheduled) == eventDate {
			return r.RaceID, nil
		}
	}
	return 0, fmt.Errorf("no NASCAR race_id for event %s on %s", eventID, eventDate)
}

func liveEventIDsForNASCARSeries(liveIDs []string, seriesID int) []string {
	prefix, ok := nascarLivePrefixBySeries[seriesID]
	if !ok {
		return nil
	}
	out := make([]string, 0, 1)
	for _, id := range liveIDs {
		if strings.HasPrefix(strings.ToUpper(id), prefix+"_") {
			out = append(out, id)
		}
	}
	return out
}

func nascarLeaderVehicle(feed *nascarCFLiveFeedJSON) *nascarCFVehicle {
	if feed == nil {
		return nil
	}
	var best *nascarCFVehicle
	for i := range feed.Vehicles {
		v := &feed.Vehicles[i]
		if v.RunningPosition <= 0 {
			continue
		}
		if best == nil || v.RunningPosition < best.RunningPosition {
			best = v
		}
	}
	return best
}

// nascarFeedRaceFinished reports whether the leader has completed the scheduled distance.
func nascarFeedRaceFinished(feed *nascarCFLiveFeedJSON) bool {
	if feed == nil || feed.LapsInRace <= 0 {
		return false
	}
	leader := nascarLeaderVehicle(feed)
	return leader != nil && leader.LapsCompleted >= feed.LapsInRace
}

func nascarEasternDateNow() string {
	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		return nascarNowFunc().Format("2006-01-02")
	}
	return nascarNowFunc().In(loc).Format("2006-01-02")
}

// nascarResolveSeriesID maps a NASCAR race_id to Cup (1), Xfinity (2), or Truck (3).
// The aggregate live feed often omits series_id, so fall back to the season schedule.
func nascarResolveSeriesID(raceID, hintedSeriesID, season int) (int, error) {
	if raceID == 0 {
		return 0, fmt.Errorf("empty race_id")
	}
	if hintedSeriesID > 0 {
		if _, ok := nascarSeriesMeta[hintedSeriesID]; ok {
			return hintedSeriesID, nil
		}
	}
	for _, seriesID := range []int{1, 2, 3} {
		races, err := fetchNASCARRacesFunc(seriesID, season)
		if err != nil {
			continue
		}
		if nascarRaceFromList(races, raceID) != nil {
			return seriesID, nil
		}
	}
	return 0, fmt.Errorf("race_id %d not in schedule", raceID)
}

// nascarFeedCountsAsLiveRace is stricter than nascarFeedLooksLive: race day only,
// not practice/qualifying placeholders (999 laps), not pre-race stale payloads.
func nascarFeedCountsAsLiveRace(feed *nascarCFLiveFeedJSON, raceDate string) bool {
	if feed == nil || feed.RaceID == 0 {
		return false
	}
	if !nascarFeedLooksLive(feed, feed.SeriesID) {
		return false
	}
	// NASCAR uses a 999-lap placeholder for practice/qualifying feeds.
	if feed.LapsInRace >= 500 {
		return false
	}
	runName := strings.ToLower(strings.TrimSpace(feed.RunName))
	if strings.Contains(runName, "practice") || strings.Contains(runName, "qualifying") {
		return false
	}
	raceDate = dateOnly(raceDate)
	if raceDate == "" || raceDate != nascarEasternDateNow() {
		return false
	}
	return true
}

func nascarEventHasRaceResults(dataDir, eventID string) bool {
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
	if st3, ok := detail.Tables["stage_3"]; ok && len(st3.Headers) > 0 && len(st3.Rows) > 0 {
		return true
	}
	return false
}

func nascarFeedLooksLive(feed *nascarCFLiveFeedJSON, expectSeriesID int) bool {
	if feed == nil || feed.RaceID == 0 {
		return false
	}
	if nascarFeedRaceFinished(feed) {
		return false
	}
	if expectSeriesID > 0 && feed.SeriesID != expectSeriesID {
		return false
	}
	if feed.LapsInRace >= 500 {
		return false
	}
	// Pre-race or stale payloads may expose vehicles without a started race.
	if feed.LapNumber <= 0 && feed.FlagState <= 0 {
		return false
	}
	for _, v := range feed.Vehicles {
		if v.RunningPosition > 0 && nascarDriverDisplayName(v.Driver) != "" {
			return true
		}
	}
	return false
}

// CollectNASCARLiveBoards returns live leaderboards for Cup (1), O'Reilly (2), and Truck (3)
// when their per-series feed is actively running. No placeholder boards on fetch errors.
func CollectNASCARLiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	// leaderLimit <= 0: include every driver with a running position.
	livePath := filepath.Join(dataDir, "live.json")
	liveIDs := readLiveIDs(livePath)
	if liveIDs == nil {
		liveIDs = []string{}
	}

	type candidate struct {
		seriesID int
		raceID   int
	}
	candidates := make(map[int]candidate)

	mainFeed, _ := fetchNASCARLiveFeedFull()
	if mainFeed != nil && mainFeed.RaceID != 0 && !nascarFeedRaceFinished(mainFeed) {
		candidates[mainFeed.SeriesID] = candidate{seriesID: mainFeed.SeriesID, raceID: mainFeed.RaceID}
	}

	// Additional series (O'Reilly, Truck) only when explicitly marked live in live.json.
	for seriesID := range nascarSeriesMeta {
		for _, eventID := range liveEventIDsForNASCARSeries(liveIDs, seriesID) {
			if _, fromMain := candidates[seriesID]; fromMain {
				continue
			}
			raceID, err := nascarRaceIDForLiveEvent(dataDir, seriesID, eventID)
			if err != nil {
				continue
			}
			candidates[seriesID] = candidate{seriesID: seriesID, raceID: raceID}
		}
	}

	seriesOrder := []int{1, 2, 3}
	boards := make([]NASCARLiveBoard, 0, len(candidates))
	seenRace := make(map[int]struct{})

	for _, seriesID := range seriesOrder {
		cand, ok := candidates[seriesID]
		if !ok || cand.raceID == 0 {
			continue
		}
		if _, dup := seenRace[cand.raceID]; dup {
			continue
		}

		feed, err := fetchNASCARSeriesLiveFeed(seriesID, cand.raceID)
		if err != nil || !nascarFeedLooksLive(feed, seriesID) {
			continue
		}
		board := nascarBoardFromFeed(feed, dataDir, leaderLimit)
		if board.EventID != "" && nascarEventHasRaceResults(dataDir, board.EventID) {
			continue
		}
		if len(board.Leaders) == 0 {
			continue
		}
		seenRace[feed.RaceID] = struct{}{}
		boards = append(boards, board)
	}

	return boards
}
