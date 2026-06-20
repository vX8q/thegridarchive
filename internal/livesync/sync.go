// Package livesync updates data/live.json from NASCAR and OpenF1 API data.
// Used by the server background loop and cmd/sync-nascar-live, cmd/sync-openf1-live utilities.
package livesync

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

const (
	nascarFeedBase  = "https://feed.nascar.com" // legacy; now returns 401 without token
	nascarCFBase    = "https://cf.nascar.com"
	nascarCFLiveFeed = nascarCFBase + "/live/feeds/live-feed.json"
	openF1Base      = "https://api.openf1.org"
	defaultInterval = 2 * time.Minute
)

var nascarSeriesToDataID = map[int]string{
	1: "nascar_cup",
	2: "noaps",
	3: "nascar_truck",
}

var (
	livesyncErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "tga_livesync_errors_total",
			Help: "Total number of livesync errors by source and reason.",
		},
		[]string{"source", "reason"},
	)
	livesyncLastSuccess = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "tga_livesync_last_success_unix",
			Help: "Unix timestamp of last successful livesync by source.",
		},
		[]string{"source"},
	)
)

func init() {
	prometheus.MustRegister(livesyncErrorsTotal, livesyncLastSuccess)
}

// Run syncs NASCAR, OpenF1, WEC, and Super Formula in sequence (each merges its result into live.json).
func Run(dataDir string) error {
	if err := SyncNASCAR(dataDir); err != nil {
		slog.Warn("livesync NASCAR failed", "err", err)
	}
	if err := SyncOpenF1(dataDir); err != nil {
		slog.Warn("livesync OpenF1 failed", "err", err)
	}
	if err := SyncWEC(dataDir); err != nil {
		slog.Warn("livesync WEC failed", "err", err)
	}
	if err := SyncSuperFormula(dataDir); err != nil {
		slog.Warn("livesync Super Formula failed", "err", err)
	}
	livePath := filepath.Join(dataDir, "live.json")
	ids := readLiveIDs(livePath)
	if ids == nil {
		ids = []string{}
	}
	slog.Info("livesync tick complete", "live_event_ids", ids)
	return nil
}

// test hooks for substituting HTTP functions in unit tests.
var (
	fetchNASCARLiveFeedFullFunc = fetchNASCARLiveFeedFull
	fetchNASCARRacesFunc        = fetchNASCARRaces
)

// SyncNASCAR updates only NASCAR entries (Cup/Xfinity/Truck) in live.json.
func SyncNASCAR(dataDir string) error {
	livePath := filepath.Join(dataDir, "live.json")
	live, err := fetchNASCARLiveFeedFullFunc()
	if err != nil || live == nil || live.RaceID == 0 {
		livesyncErrorsTotal.WithLabelValues("nascar", "live_feed").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	if nascarFeedRaceFinished(live) {
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	season, _ := strconv.Atoi(config.CurrentSeason)
	seriesID, err := nascarResolveSeriesID(live.RaceID, live.SeriesID, season)
	if err != nil {
		livesyncErrorsTotal.WithLabelValues("nascar", "unknown_series").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	live.SeriesID = seriesID
	dataID, ok := nascarSeriesToDataID[seriesID]
	if !ok {
		livesyncErrorsTotal.WithLabelValues("nascar", "unknown_series").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	races, err := fetchNASCARRacesFunc(seriesID, season)
	if err != nil {
		livesyncErrorsTotal.WithLabelValues("nascar", "races_fetch").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	raceDate := make(map[int]string)
	for _, r := range races {
		if r.RaceID != 0 && r.DateScheduled != "" {
			raceDate[r.RaceID] = dateOnly(r.DateScheduled)
		}
	}
	schedDate, ok := raceDate[live.RaceID]
	if !ok {
		livesyncErrorsTotal.WithLabelValues("nascar", "race_not_found").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	events, err := schedulefile.LoadEvents(dataDir, dataID)
	if err != nil || len(events) == 0 {
		livesyncErrorsTotal.WithLabelValues("nascar", "no_events").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	eventID := findEventByDate(events, schedDate, false)
	if eventID == "" {
		livesyncErrorsTotal.WithLabelValues("nascar", "no_matching_event").Inc()
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	if !nascarFeedCountsAsLiveRace(live, schedDate) {
		return mergeLiveJSONNASCAR(livePath, nil)
	}
	if err := mergeLiveJSONNASCAR(livePath, []string{eventID}); err != nil {
		livesyncErrorsTotal.WithLabelValues("nascar", "write_live_json").Inc()
		return err
	}
	livesyncLastSuccess.WithLabelValues("nascar").Set(float64(time.Now().Unix()))
	return nil
}

// SyncOpenF1 updates only F1 entries in live.json.
func SyncOpenF1(dataDir string) error {
	livePath := filepath.Join(dataDir, "live.json")
	session, err := findOpenF1LiveSessionAt(openF1NowFunc())
	if err != nil {
		livesyncErrorsTotal.WithLabelValues("openf1", "sessions_fetch").Inc()
		return mergeLiveJSONF1(livePath, nil)
	}
	if session == nil {
		livesyncErrorsTotal.WithLabelValues("openf1", "no_live_window").Inc()
		return mergeLiveJSONF1(livePath, nil)
	}
	events, err := schedulefile.LoadEvents(dataDir, "f1")
	if err != nil || len(events) == 0 {
		livesyncErrorsTotal.WithLabelValues("openf1", "no_events").Inc()
		return mergeLiveJSONF1(livePath, nil)
	}
	eventID := findEventByDate(events, session.DateStart, true)
	if eventID == "" {
		livesyncErrorsTotal.WithLabelValues("openf1", "no_matching_event").Inc()
		return mergeLiveJSONF1(livePath, nil)
	}
	if err := mergeLiveJSONF1(livePath, []string{eventID}); err != nil {
		livesyncErrorsTotal.WithLabelValues("openf1", "write_live_json").Inc()
		return err
	}
	livesyncLastSuccess.WithLabelValues("openf1").Set(float64(time.Now().Unix()))
	return nil
}

func sameWeekend(a, b string) bool {
	t1, err1 := time.Parse("2006-01-02", a)
	t2, err2 := time.Parse("2006-01-02", b)
	if err1 != nil || err2 != nil {
		return false
	}
	diff := t1.Sub(t2)
	if diff < 0 {
		diff = -diff
	}
	return diff <= 3*24*time.Hour
}

func dateOnly(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 10 {
		return s[:10]
	}
	return s
}

// findEventByDate looks up an event ID by start date.
// First tries an exact date match (YYYY-MM-DD);
// when allowWeekend=true, also allows a match within the same race weekend.
func findEventByDate(events []schedulefile.EventJSON, target string, allowWeekend bool) string {
	target = strings.TrimSpace(target)
	if target == "" {
		return ""
	}
	if len(target) > 10 {
		target = target[:10]
	}
	// First, exact date match.
	for _, e := range events {
		d := strings.TrimSpace(e.StartDate)
		if len(d) >= 10 {
			d = d[:10]
		}
		if d == target {
			return e.ID
		}
	}
	if !allowWeekend {
		return ""
	}
	// Then, match by race weekend.
	for _, e := range events {
		d := strings.TrimSpace(e.StartDate)
		if len(d) >= 10 {
			d = d[:10]
		}
		if sameWeekend(target, d) {
			return e.ID
		}
	}
	return ""
}

func readLiveIDs(livePath string) []string {
	raw, err := os.ReadFile(livePath) //nolint:gosec
	if err != nil {
		return nil
	}
	var decoded struct {
		LiveEventIDs []string `json:"live_event_ids"`
	}
	if json.Unmarshal(raw, &decoded) == nil && len(decoded.LiveEventIDs) > 0 {
		return decoded.LiveEventIDs
	}
	var ids []string
	if json.Unmarshal(raw, &ids) == nil {
		return ids
	}
	return nil
}

func writeLiveJSON(path string, ids []string) error {
	if ids == nil {
		ids = []string{}
	}
	b, err := json.MarshalIndent(ids, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o600)
}

func mergeLiveJSONNASCAR(livePath string, newNascarIDs []string) error {
	current := readLiveIDs(livePath)
	if current == nil {
		current = []string{}
	}
	// Build a set of already recorded IDs (excluding NASCAR series) for deduplication.
	filtered := current[:0]
	seen := make(map[string]struct{}, len(current))
	for _, id := range current {
		u := strings.ToUpper(id)
		if strings.HasPrefix(u, "NASCAR_CUP") || strings.HasPrefix(u, "NOAPS") || strings.HasPrefix(u, "NASCAR_TRUCK") {
			continue
		}
		filtered = append(filtered, id)
		seen[u] = struct{}{}
	}
	for _, id := range newNascarIDs {
		if id == "" {
			continue
		}
		u := strings.ToUpper(id)
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		filtered = append(filtered, id)
	}
	return writeLiveJSON(livePath, filtered)
}

func mergeLiveJSONF1(livePath string, newF1Ids []string) error {
	current := readLiveIDs(livePath)
	if current == nil {
		current = []string{}
	}
	filtered := current[:0]
	seen := make(map[string]struct{}, len(current))
	for _, id := range current {
		u := strings.ToUpper(id)
		if strings.HasPrefix(u, "F1_") {
			continue
		}
		filtered = append(filtered, id)
		seen[u] = struct{}{}
	}
	for _, id := range newF1Ids {
		if id == "" {
			continue
		}
		u := strings.ToUpper(id)
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		filtered = append(filtered, id)
	}
	return writeLiveJSON(livePath, filtered)
}

func mergeLiveJSONWEC(livePath string, newWECIDs []string) error {
	current := readLiveIDs(livePath)
	if current == nil {
		current = []string{}
	}
	filtered := current[:0]
	seen := make(map[string]struct{}, len(current))
	for _, id := range current {
		u := strings.ToUpper(id)
		if strings.HasPrefix(u, "WEC_") {
			continue
		}
		filtered = append(filtered, id)
		seen[u] = struct{}{}
	}
	for _, id := range newWECIDs {
		if id == "" {
			continue
		}
		u := strings.ToUpper(id)
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		filtered = append(filtered, id)
	}
	return writeLiveJSON(livePath, filtered)
}

func mergeLiveJSONSuperFormula(livePath string, newSFIDs []string) error {
	current := readLiveIDs(livePath)
	if current == nil {
		current = []string{}
	}
	filtered := current[:0]
	seen := make(map[string]struct{}, len(current))
	for _, id := range current {
		u := strings.ToUpper(id)
		if strings.HasPrefix(u, "SUPER_FORMULA_") {
			continue
		}
		filtered = append(filtered, id)
		seen[u] = struct{}{}
	}
	for _, id := range newSFIDs {
		if id == "" {
			continue
		}
		u := strings.ToUpper(id)
		if _, ok := seen[u]; ok {
			continue
		}
		seen[u] = struct{}{}
		filtered = append(filtered, id)
	}
	return writeLiveJSON(livePath, filtered)
}

// ——— NASCAR API ———

type nascarRace struct {
	RaceID        int    `json:"race_id"`
	DateScheduled string `json:"date_scheduled"`
}

type nascarRaceListBasic struct {
	Series1 []nascarRace `json:"series_1"`
	Series2 []nascarRace `json:"series_2"`
	Series3 []nascarRace `json:"series_3"`
}

func fetchNASCARRaces(seriesID, season int) ([]nascarRace, error) {
	url := fmt.Sprintf("%s/cacher/%d/race_list_basic.json", nascarCFBase, season)
	var decoded nascarRaceListBasic
	if err := livesyncGetJSON(url, &decoded); err != nil {
		return nil, err
	}
	switch seriesID {
	case 1:
		return decoded.Series1, nil
	case 2:
		return decoded.Series2, nil
	case 3:
		return decoded.Series3, nil
	default:
		return nil, fmt.Errorf("unknown series_id %d", seriesID)
	}
}

// StartBackground starts a background sync loop every interval (0 = 2 minutes).
// Stops when ctx is cancelled.
func StartBackground(ctx context.Context, dataDir string, interval time.Duration) {
	if interval <= 0 {
		interval = defaultInterval
	}
	StartSuperFormulaCacheLoop(ctx)
	slog.Info("livesync background worker started", "interval", interval.String(), "data_dir", dataDir)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	if err := Run(dataDir); err != nil {
		slog.Warn("livesync background tick error", "err", err)
	}
	for {
		select {
		case <-ctx.Done():
			slog.Info("livesync background worker stopped")
			return
		case <-ticker.C:
			if err := Run(dataDir); err != nil {
				slog.Warn("livesync background tick error", "err", err)
			}
		}
	}
}
