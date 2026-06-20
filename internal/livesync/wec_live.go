package livesync

import (
	"fmt"
	"math"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/vX8q/tga/internal/schedulefile"
)

const (
	wecLiveJSONURL = "https://storage.googleapis.com/ecm-prod/live/WEC/data.json"
	wecSeriesKey   = "WEC"
	wecSeriesName  = "FIA World Endurance Championship"
)

type wecLiveSnapshot struct {
	Params  wecLiveParams  `json:"params"`
	Entries []wecLiveEntry `json:"entries"`
}

type wecLiveParams struct {
	SessionName         string  `json:"sessionName"`
	SessionID           int     `json:"sessionId"`
	RaceState           string  `json:"raceState"`
	StartTime           float64 `json:"startTime"`
	Duration            float64 `json:"duration"`
	ElapsedTime         float64 `json:"elapsedTime"`
	Remaining           float64 `json:"remaining"`
	PercentProgressLive float64 `json:"percentProgressLive"`
	EventName           string  `json:"eventName"`
	Replay              bool    `json:"replay"`
}

type wecLiveEntry struct {
	Number   flexJSONInt `json:"number"`
	Ranking  flexJSONInt `json:"ranking"`
	Driver   string      `json:"driver"`
	Team     string      `json:"team"`
	Car      string      `json:"car"`
	Category string      `json:"category"`
	Lap      flexJSONInt `json:"lap"`
	Gap      string      `json:"gap"`
	GapTime  float64     `json:"gapTime"`
	State    string      `json:"state"`
}

var (
	fetchWECLiveSnapshotFunc = fetchWECLiveSnapshot
	wecNowFunc               = func() time.Time { return time.Now().UTC() }
)

func fetchWECLiveSnapshot() (*wecLiveSnapshot, error) {
	var out wecLiveSnapshot
	if err := livesyncGetJSON(wecLiveJSONURL, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func wecRaceStateFinished(state string) bool {
	switch strings.ToUpper(strings.TrimSpace(state)) {
	case "CHK", "FIN", "END", "FINISH", "FINISHED":
		return true
	default:
		return false
	}
}

func wecSessionStartTime(params wecLiveParams) time.Time {
	if params.StartTime <= 0 {
		return time.Time{}
	}
	ms := int64(params.StartTime)
	return time.UnixMilli(ms).UTC()
}

func wecSessionLooksLive(snap *wecLiveSnapshot, now time.Time) bool {
	if snap == nil {
		return false
	}
	if snap.Params.Replay {
		return false
	}
	if wecRaceStateFinished(snap.Params.RaceState) {
		return false
	}
	if snap.Params.PercentProgressLive >= 100 && snap.Params.Remaining <= 0 {
		return false
	}
	if len(snap.Entries) == 0 {
		return false
	}
	hasRunner := false
	for _, e := range snap.Entries {
		if e.Ranking.Int() > 0 && strings.TrimSpace(e.Driver) != "" {
			hasRunner = true
			break
		}
	}
	if !hasRunner {
		return false
	}
	start := wecSessionStartTime(snap.Params)
	if !start.IsZero() && snap.Params.Duration > 0 {
		end := start.Add(time.Duration(snap.Params.Duration) * time.Second)
		grace := 30 * time.Minute
		if now.After(end.Add(grace)) {
			return false
		}
	}
	return true
}

func wecGapDisplay(entry wecLiveEntry, position int) string {
	if position == 1 {
		return "—"
	}
	gap := strings.TrimSpace(entry.Gap)
	if gap == "" || gap == "-" {
		if entry.GapTime > 0 {
			return "+" + formatOpenF1GapSeconds(entry.GapTime)
		}
		return ""
	}
	upper := strings.ToUpper(gap)
	if strings.Contains(upper, "LAP") {
		if strings.HasPrefix(gap, "+") {
			return gap
		}
		return "+" + gap
	}
	if f, err := strconv.ParseFloat(gap, 64); err == nil && f > 0 {
		return formatOpenF1GapSeconds(f)
	}
	if !strings.HasPrefix(gap, "+") {
		return "+" + gap
	}
	return gap
}

func wecLeaderboardFrom(entries []wecLiveEntry, limit int) []nascarLiveRunningEntry {
	type row struct {
		entry wecLiveEntry
	}
	rows := make([]row, 0, len(entries))
	for _, e := range entries {
		if e.Ranking.Int() <= 0 || strings.TrimSpace(e.Driver) == "" {
			continue
		}
		rows = append(rows, row{entry: e})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].entry.Ranking.Int() != rows[j].entry.Ranking.Int() {
			return rows[i].entry.Ranking.Int() < rows[j].entry.Ranking.Int()
		}
		return rows[i].entry.Number.Int() < rows[j].entry.Number.Int()
	})
	capacity := len(rows)
	if limit > 0 && limit < capacity {
		capacity = limit
	}
	out := make([]nascarLiveRunningEntry, 0, capacity)
	for _, r := range rows {
		e := r.entry
		entry := nascarLiveRunningEntry{
			Position:     e.Ranking.Int(),
			CarNumber:    e.Number.String(),
			Driver:       strings.TrimSpace(e.Driver),
			Manufacturer: strings.TrimSpace(e.Car),
			GapDisplay:   wecGapDisplay(e, e.Ranking.Int()),
		}
		if team := strings.TrimSpace(e.Team); team != "" {
			if entry.Manufacturer != "" {
				entry.Manufacturer = team + " · " + entry.Manufacturer
			} else {
				entry.Manufacturer = team
			}
		}
		if e.Lap.Int() > 0 {
			entry.LapsCompleted = e.Lap.Int()
		}
		out = append(out, entry)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func wecEventHasRaceResults(dataDir, eventID string) bool {
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

func wecBoardFromSnapshot(snap *wecLiveSnapshot, dataDir string, limit int) (NASCARLiveBoard, error) {
	if snap == nil {
		return NASCARLiveBoard{Error: "no snapshot"}, fmt.Errorf("no snapshot")
	}
	leaders := wecLeaderboardFrom(snap.Entries, limit)
	if len(leaders) == 0 {
		return NASCARLiveBoard{Error: "no leaders"}, fmt.Errorf("no leaders")
	}
	board := NASCARLiveBoard{
		SeriesID:   snap.Params.SessionID,
		SeriesKey:  wecSeriesKey,
		SeriesName: wecSeriesName,
		RaceID:     snap.Params.SessionID,
		RunName:    strings.TrimSpace(snap.Params.SessionName),
		Leaders:    leaders,
		FeedURL:    wecLiveJSONURL,
	}
	if name := strings.TrimSpace(snap.Params.EventName); name != "" && !strings.EqualFold(name, "N/A") {
		board.TrackName = name
	}
	if leaders[0].LapsCompleted > 0 {
		board.LapNumber = leaders[0].LapsCompleted
	}
	if board.LapNumber > math.MaxInt32 {
		board.LapNumber = 0
	}

	events, err := schedulefile.LoadEvents(dataDir, "wec")
	if err == nil && len(events) > 0 {
		start := wecSessionStartTime(snap.Params)
		if !start.IsZero() {
			board.EventID = findEventByDate(events, start.Format("2006-01-02"), true)
		}
	}
	if board.EventID != "" && strings.EqualFold(snap.Params.SessionName, "Race") && wecEventHasRaceResults(dataDir, board.EventID) {
		return NASCARLiveBoard{Error: "race results published"}, fmt.Errorf("race results published")
	}
	return board, nil
}

// CollectWECLiveBoards returns a WEC leaderboard when the ECM live JSON indicates an active session.
func CollectWECLiveBoards(dataDir string, leaderLimit int) []NASCARLiveBoard {
	snap, err := fetchWECLiveSnapshotFunc()
	if err != nil || !wecSessionLooksLive(snap, wecNowFunc()) {
		return nil
	}
	board, err := wecBoardFromSnapshot(snap, dataDir, leaderLimit)
	if err != nil || len(board.Leaders) == 0 {
		return nil
	}
	return []NASCARLiveBoard{board}
}

// SyncWEC updates WEC entries in live.json from the ECM live JSON feed.
func SyncWEC(dataDir string) error {
	livePath := filepath.Join(dataDir, "live.json")
	snap, err := fetchWECLiveSnapshotFunc()
	if err != nil {
		livesyncErrorsTotal.WithLabelValues("wec", "live_feed").Inc()
		return mergeLiveJSONWEC(livePath, nil)
	}
	if !wecSessionLooksLive(snap, wecNowFunc()) {
		livesyncErrorsTotal.WithLabelValues("wec", "no_live_window").Inc()
		return mergeLiveJSONWEC(livePath, nil)
	}
	events, err := schedulefile.LoadEvents(dataDir, "wec")
	if err != nil || len(events) == 0 {
		livesyncErrorsTotal.WithLabelValues("wec", "no_events").Inc()
		return mergeLiveJSONWEC(livePath, nil)
	}
	start := wecSessionStartTime(snap.Params)
	if start.IsZero() {
		livesyncErrorsTotal.WithLabelValues("wec", "no_start_time").Inc()
		return mergeLiveJSONWEC(livePath, nil)
	}
	eventID := findEventByDate(events, start.Format("2006-01-02"), true)
	if eventID == "" {
		livesyncErrorsTotal.WithLabelValues("wec", "no_matching_event").Inc()
		return mergeLiveJSONWEC(livePath, nil)
	}
	if err := mergeLiveJSONWEC(livePath, []string{eventID}); err != nil {
		livesyncErrorsTotal.WithLabelValues("wec", "write_live_json").Inc()
		return err
	}
	livesyncLastSuccess.WithLabelValues("wec").Set(float64(time.Now().Unix()))
	return nil
}
