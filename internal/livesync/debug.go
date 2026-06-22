package livesync

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

// DebugReport is a temporary snapshot of live sync inputs/outputs for the /api/live-debug page.
type DebugReport struct {
	FetchedAt     time.Time          `json:"fetched_at"`
	LiveJSON      []string           `json:"live_json"`
	NASCAR        NASCARDebug        `json:"nascar"`
	OpenF1        OpenF1Debug        `json:"openf1"`
	WEC           WECDebug           `json:"wec"`
	SuperFormula  SuperFormulaDebug  `json:"super_formula"`
}

// NASCARDebug holds NASCAR live sync debug fields for DebugReport.
type NASCARDebug struct {
	LiveFeedURL      string                   `json:"live_feed_url"`
	LegacyFeedURL    string                   `json:"legacy_feed_url,omitempty"`
	LegacyFeedStatus string                   `json:"legacy_feed_status,omitempty"`
	Boards           []NASCARLiveBoard        `json:"boards,omitempty"`
	LiveFeed         *nascarLiveFeed          `json:"live_feed,omitempty"`
	LiveRaceSummary  *nascarLiveRaceSummary   `json:"live_race_summary,omitempty"`
	LiveLeaderboard  []nascarLiveRunningEntry `json:"live_leaderboard,omitempty"`
	LiveFeedError    string                   `json:"live_feed_error,omitempty"`
	RacesURL         string                   `json:"races_url,omitempty"`
	MatchedRace      *nascarRace              `json:"matched_race,omitempty"`
	RacesError       string                   `json:"races_error,omitempty"`
	MappedEventID    string                   `json:"mapped_event_id,omitempty"`
}

// OpenF1Debug holds OpenF1 live sync debug fields for DebugReport.
type OpenF1Debug struct {
	URL           string              `json:"url"`
	Sessions      []openF1SessionFull `json:"sessions,omitempty"`
	LiveSession   *openF1SessionFull  `json:"live_session,omitempty"`
	Board         *NASCARLiveBoard    `json:"board,omitempty"`
	Error         string              `json:"error,omitempty"`
	MappedEventID string              `json:"mapped_event_id,omitempty"`
	InLiveWindow  *bool               `json:"in_live_window,omitempty"`
}

// WECDebug holds WEC live sync debug fields for DebugReport.
type WECDebug struct {
	URL           string           `json:"url"`
	Snapshot      *wecLiveSnapshot `json:"snapshot,omitempty"`
	Board         *NASCARLiveBoard `json:"board,omitempty"`
	Error         string           `json:"error,omitempty"`
	MappedEventID string           `json:"mapped_event_id,omitempty"`
	InLiveWindow  *bool            `json:"in_live_window,omitempty"`
}

// SuperFormulaDebug holds Super Formula live sync debug fields for DebugReport.
type SuperFormulaDebug struct {
	URL           string              `json:"url"`
	WebSocketURL  string              `json:"websocket_url"`
	Snapshot      *sfRaceNowSnapshot  `json:"snapshot,omitempty"`
	Board         *NASCARLiveBoard    `json:"board,omitempty"`
	Error         string              `json:"error,omitempty"`
	MappedEventID string              `json:"mapped_event_id,omitempty"`
	InLiveWindow  *bool               `json:"in_live_window,omitempty"`
}

// CollectDebug fetches NASCAR LiveFeed, NASCAR races (when live), and OpenF1 latest session.
func CollectDebug(dataDir string) DebugReport {
	out := DebugReport{FetchedAt: time.Now().UTC()}
	livePath := filepath.Join(dataDir, "live.json")
	ids := readLiveIDs(livePath)
	if ids == nil {
		ids = []string{}
	}
	out.LiveJSON = ids

	out.NASCAR.LiveFeedURL = nascarCFLiveFeed
	out.NASCAR.LegacyFeedURL = nascarFeedBase + "/api/LiveFeed"
	if status, err := probeNASCARLegacyFeed(); err != nil {
		out.NASCAR.LegacyFeedStatus = err.Error()
	} else {
		out.NASCAR.LegacyFeedStatus = "HTTP " + strconv.Itoa(status)
	}
	out.NASCAR.Boards = CollectNASCARLiveBoards(dataDir, 20)
	feedFull, err := fetchNASCARLiveFeedFull()
	if err != nil {
		out.NASCAR.LiveFeedError = err.Error()
	} else if feedFull != nil {
		out.NASCAR.LiveFeed = &nascarLiveFeed{
			RaceID:   feedFull.RaceID,
			SeriesID: feedFull.SeriesID,
		}
		out.NASCAR.LiveRaceSummary = nascarLiveRaceSummaryFrom(feedFull)
		out.NASCAR.LiveLeaderboard = nascarLiveLeaderboardFrom(feedFull, 20)
	}

	if feedFull != nil && feedFull.RaceID != 0 {
		dataID, ok := nascarSeriesToDataID[feedFull.SeriesID]
		if ok {
			season, _ := strconv.Atoi(config.CurrentSeason)
			out.NASCAR.RacesURL = fmt.Sprintf("%s/cacher/%d/race_list_basic.json", nascarCFBase, season)
			races, racesErr := fetchNASCARRacesFunc(feedFull.SeriesID, season)
			if racesErr != nil {
				out.NASCAR.RacesError = racesErr.Error()
			} else {
				out.NASCAR.MatchedRace = nascarRaceFromList(races, feedFull.RaceID)
				raceDate := make(map[int]string)
				for _, r := range races {
					if r.RaceID != 0 && r.DateScheduled != "" {
						raceDate[r.RaceID] = dateOnly(r.DateScheduled)
					}
				}
				if schedDate, ok := raceDate[feedFull.RaceID]; ok {
					events, evErr := schedulefile.LoadEvents(dataDir, dataID)
					if evErr == nil && len(events) > 0 {
						out.NASCAR.MappedEventID = findEventByDate(events, schedDate, false)
					}
				}
			}
		}
	}

	out.OpenF1.URL = openF1Base + "/v1/sessions?meeting_key=latest"
	sessions, err := fetchOpenF1LatestMeetingSessionsFunc()
	if err != nil {
		out.OpenF1.Error = err.Error()
	} else {
		out.OpenF1.Sessions = sessions
		now := time.Now().UTC()
		if live := pickOpenF1LiveSession(sessions, now); live != nil {
			out.OpenF1.LiveSession = live
			inWindow := true
			out.OpenF1.InLiveWindow = &inWindow
			events, evErr := schedulefile.LoadEvents(dataDir, "f1")
			if evErr == nil && len(events) > 0 {
				out.OpenF1.MappedEventID = findEventByDate(events, live.DateStart, true)
			}
			if boards := CollectF1LiveBoards(dataDir, LiveBoardLeaderLimit); len(boards) > 0 {
				boardCopy := boards[0]
				out.OpenF1.Board = &boardCopy
			}
		} else if latest, latestErr := fetchOpenF1SessionsLatestRawFunc(); latestErr == nil && len(latest) > 0 {
			out.OpenF1.Sessions = append(out.OpenF1.Sessions, latest...)
			inWindow := openF1SessionInLiveWindow(&latest[0], now)
			out.OpenF1.InLiveWindow = &inWindow
			events, evErr := schedulefile.LoadEvents(dataDir, "f1")
			if evErr == nil && len(events) > 0 {
				out.OpenF1.MappedEventID = findEventByDate(events, latest[0].DateStart, true)
			}
		}
	}

	out.WEC.URL = wecLiveJSONURL
	snap, snapErr := fetchWECLiveSnapshotFunc()
	if snapErr != nil {
		out.WEC.Error = snapErr.Error()
	} else if snap != nil {
		snapCopy := *snap
		out.WEC.Snapshot = &snapCopy
		now := time.Now().UTC()
		inWindow := wecSessionLooksLive(snap, now)
		out.WEC.InLiveWindow = &inWindow
		events, evErr := schedulefile.LoadEvents(dataDir, "wec")
		if evErr == nil && len(events) > 0 {
			start := wecSessionStartTime(snap.Params)
			if !start.IsZero() {
				out.WEC.MappedEventID = findEventByDate(events, start.Format("2006-01-02"), true)
			}
		}
		if boards := CollectWECLiveBoards(dataDir, LiveBoardLeaderLimit); len(boards) > 0 {
			b := boards[0]
			out.WEC.Board = &b
		}
	}

	out.SuperFormula.URL = superFormulaLivePage
	out.SuperFormula.WebSocketURL = superFormulaWSURL
	sfSnap, sfErr := fetchSuperFormulaRaceNowSnapshotCached()
	if sfErr != nil {
		out.SuperFormula.Error = sfErr.Error()
	} else if sfSnap != nil {
		sfSnapCopy := cloneSuperFormulaSnapshot(sfSnap)
		out.SuperFormula.Snapshot = sfSnapCopy
		inWindow := superFormulaSessionLooksLive(sfSnap)
		out.SuperFormula.InLiveWindow = &inWindow
		events, evErr := schedulefile.LoadEvents(dataDir, "super_formula")
		if evErr == nil && len(events) > 0 {
			out.SuperFormula.MappedEventID = findSuperFormulaLiveEvent(events, time.Now().UTC())
		}
		if boards := CollectSuperFormulaLiveBoards(dataDir, LiveBoardLeaderLimit); len(boards) > 0 {
			b := boards[0]
			out.SuperFormula.Board = &b
		}
	}

	return out
}

func probeNASCARLegacyFeed() (int, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(nascarFeedBase + "/api/LiveFeed")
	if err != nil {
		return 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	return resp.StatusCode, nil
}
