package schedulefile

import (
	"strings"
	"time"

	"github.com/vX8q/tga/config"
)

func standingsSeasonOrDefault(season string) string {
	if strings.TrimSpace(season) == "" {
		return config.CurrentSeason
	}
	return season
}

// skipStandingsScheduleEvent mirrors event-skip rules in BuildStandingsFromEvents.
func skipStandingsScheduleEvent(seriesID, season, today string, ev EventJSON) bool {
	if ev.Season != season {
		return true
	}
	if skipChampionshipMetricsEvent(seriesID, ev.ID) {
		return true
	}
	if isFutureScheduleEvent(ev, today) {
		return true
	}
	return false
}

func isSprintFeatureSeriesID(seriesID string) bool {
	return strings.EqualFold(seriesID, "F1") ||
		strings.EqualFold(seriesID, "F2") ||
		strings.EqualFold(seriesID, "F3")
}

func eventDetailHasRaceResults(seriesID string, detail *EventDetailJSON, sessions []RaceSession) bool {
	if detail == nil || detail.Tables == nil {
		return false
	}
	rr, ok := detail.Tables["race_results"]
	if (!ok || len(rr.Headers) == 0 || len(rr.Rows) == 0) && stockCarSeriesUsesStagePoints(seriesID) {
		if st3, ok3 := detail.Tables["stage3"]; ok3 && len(st3.Headers) > 0 && len(st3.Rows) > 0 {
			return true
		}
	}
	if ok && len(rr.Headers) > 0 && len(rr.Rows) > 0 {
		return true
	}
	if ra, okRace := detail.Tables["race"]; okRace && len(ra.Headers) > 0 && len(ra.Rows) > 0 {
		return true
	}
	if len(sessions) > 0 {
		rs := sessions[0]
		return len(rs.Headers) > 0 && len(rs.Rows) > 0
	}
	return false
}

// eventHasFourStages is true for Cup races with a points-paying stage 3
// (Coca-Cola 600): stage4_laps set, or an explicit stage_4 / stage4 table.
func eventHasFourStages(detail *EventDetailJSON) bool {
	if detail == nil {
		return false
	}
	if strings.TrimSpace(detail.Stage4Laps) != "" {
		return true
	}
	if detail.Tables == nil {
		return false
	}
	if t, ok := detail.Tables["stage_4"]; ok && len(t.Rows) > 0 {
		return true
	}
	if t, ok := detail.Tables["stage4"]; ok && len(t.Rows) > 0 {
		return true
	}
	return false
}

func addDriverPointsFromResultsTable(seriesID string, st EventTable, into map[string]int) {
	if into == nil || len(st.Headers) == 0 || len(st.Rows) == 0 {
		return
	}
	isStockCarSeries := strings.EqualFold(seriesID, "NASCAR_CUP") ||
		strings.EqualFold(seriesID, "NOAPS") ||
		strings.EqualFold(seriesID, "NASCAR_TRUCK") ||
		strings.EqualFold(seriesID, "ARCA") ||
		strings.EqualFold(seriesID, "NASCAR_MODIFIED")

	sDriverCol := colIndex(st.Headers, "Driver")
	sPtsCol := colIndex(st.Headers, "Points")
	if sPtsCol < 0 {
		sPtsCol = colIndex(st.Headers, "Pts")
	}
	if sDriverCol < 0 || sPtsCol < 0 {
		return
	}
	for _, row := range st.Rows {
		if sDriverCol >= len(row) || sPtsCol >= len(row) {
			continue
		}
		d := strings.TrimSpace(row[sDriverCol])
		if d == "" {
			continue
		}
		if isStockCarSeries {
			d = stockCarIneligibleDriver(d, "", nil)
		}
		pts := 0
		if s := strings.TrimSpace(row[sPtsCol]); s != "" {
			for _, c := range s {
				if c >= '0' && c <= '9' {
					pts = pts*10 + int(c-'0')
				}
			}
		}
		into[canonicalDriverKey(d)] += pts
	}
}

// accumulateStagePointsFromDetail sums championship Stage Points for standings:
// stage_1 + stage_2, plus stage_3 on 4-stage Cup races, plus Daytona Duel points
// for NASCAR_CUP (Wikipedia / NASCAR.com Stage column). Duel points must NOT be
// added to Pts — they are already included in Daytona race_results Points.
func accumulateStagePointsFromDetail(seriesID string, detail *EventDetailJSON, into map[string]int) {
	if detail == nil || detail.Tables == nil || into == nil {
		return
	}
	maxStage := 2
	if eventHasFourStages(detail) {
		maxStage = 3
	}
	for sn := 1; sn <= maxStage; sn++ {
		st, ok := StageN(detail.Tables, sn)
		if !ok {
			continue
		}
		addDriverPointsFromResultsTable(seriesID, st, into)
	}
	if strings.EqualFold(seriesID, "NASCAR_CUP") {
		for _, key := range []string{"duel1", "duel2", "duel_1", "duel_2"} {
			if st, ok := detail.Tables[key]; ok {
				addDriverPointsFromResultsTable(seriesID, st, into)
			}
		}
	}
}

type standingsFinalizeOpts struct {
	completed bool
	stages    bool
}

type standingsEventCache struct {
	dataDir       string
	detailCache   map[string]cachedEventDetail
	sessionsCache map[string][]RaceSession
}

type cachedEventDetail struct {
	detail *EventDetailJSON
	err    error
}

func newStandingsEventCache(dataDir string) *standingsEventCache {
	return &standingsEventCache{
		dataDir:       dataDir,
		detailCache:   make(map[string]cachedEventDetail),
		sessionsCache: make(map[string][]RaceSession),
	}
}

func (c *standingsEventCache) loadDetail(eventID string) (*EventDetailJSON, error) {
	key := strings.ToLower(strings.TrimSpace(eventID))
	if cached, ok := c.detailCache[key]; ok {
		return cached.detail, cached.err
	}
	detail, err := LoadEventDetail(c.dataDir, eventID)
	c.detailCache[key] = cachedEventDetail{detail: detail, err: err}
	return detail, err
}

func (c *standingsEventCache) loadRaceSessions(eventID string) ([]RaceSession, error) {
	key := strings.ToLower(strings.TrimSpace(eventID))
	if sessions, ok := c.sessionsCache[key]; ok {
		return sessions, nil
	}
	detail, err := c.loadDetail(eventID)
	if err != nil || detail == nil || detail.Tables == nil {
		c.sessionsCache[key] = nil
		return nil, err
	}
	var out []RaceSession
	raceAny, ok := detail.Tables["race"]
	if !ok {
		raceAny, ok = detail.Tables["race_results"]
		if !ok {
			c.sessionsCache[key] = nil
			return nil, nil
		}
	}
	if len(raceAny.Sessions) > 0 {
		out = make([]RaceSession, 0, len(raceAny.Sessions))
		for _, session := range raceAny.Sessions {
			out = append(out, RaceSession(session))
		}
	} else if len(raceAny.Headers) > 0 && len(raceAny.Rows) > 0 {
		title := strings.TrimSpace(raceAny.Title)
		if title == "" {
			title = "Race"
		}
		out = []RaceSession{{Title: title, Headers: raceAny.Headers, Rows: raceAny.Rows}}
	}
	c.sessionsCache[key] = out
	return out, nil
}

// FinalizeStandingsFromEvents fills CompletedRaces (when empty) and stage totals in one event walk.
func FinalizeStandingsFromEvents(dataDir, seriesID, season string, data *StandingsData) {
	finalizeStandingsFromEvents(dataDir, seriesID, season, data, standingsFinalizeOpts{completed: true, stages: true})
}

func finalizeStandingsFromEvents(dataDir, seriesID, season string, data *StandingsData, opts standingsFinalizeOpts) {
	if data == nil {
		return
	}
	fillCompleted := opts.completed && len(data.RaceOrder) > 0 && len(data.CompletedRaces) == 0 &&
		!strings.EqualFold(seriesID, "SUPERCARS") && !strings.EqualFold(seriesID, "SUPER_FORMULA")
	fillStages := opts.stages && len(data.Rows) > 0 && !strings.EqualFold(seriesID, "ARCA")
	if !fillCompleted && !fillStages {
		return
	}

	events, err := LoadEvents(dataDir, seriesID)
	if err != nil || len(events) == 0 {
		return
	}

	season = standingsSeasonOrDefault(season)
	today := time.Now().Format(dateFormat)
	cache := newStandingsEventCache(dataDir)
	stagePointsByDriver := make(map[string]int)
	var completed []string

	isDTMSeries := strings.EqualFold(seriesID, "DTM")
	isMultiRacePerEvent := strings.EqualFold(seriesID, "FREC") || strings.EqualFold(seriesID, "F4_IT")
	raceIdx := 0

	for _, ev := range events {
		if skipStandingsScheduleEvent(seriesID, season, today, ev) {
			continue
		}
		if fillCompleted && raceIdx >= len(data.RaceOrder) {
			break
		}

		detail, _ := cache.loadDetail(ev.ID)

		if fillStages {
			// Stage results are published before the race classification, so a
			// weekend in progress still counts toward the Stage column.
			accumulateStagePointsFromDetail(seriesID, detail, stagePointsByDriver)
		}
		if !fillCompleted {
			continue
		}

		if isDTMSeries || isMultiRacePerEvent {
			sessions, errSess := cache.loadRaceSessions(ev.ID)
			if errSess == nil && len(sessions) > 0 {
				for _, rs := range sessions {
					if raceIdx >= len(data.RaceOrder) {
						break
					}
					hasResults := len(rs.Headers) > 0 && len(rs.Rows) > 0
					if !hasResults && detail != nil && len(detail.EntryList) > 0 {
						hasResults = true
					}
					if hasResults {
						completed = append(completed, data.RaceOrder[raceIdx])
					}
					raceIdx++
				}
				continue
			}
		}

		if isSprintFeatureSeriesID(seriesID) && raceIdx+1 < len(data.RaceOrder) {
			if _, _, _, ok := f1SprintWeekendTables(dataDir, ev.ID); ok {
				completed = append(completed, data.RaceOrder[raceIdx], data.RaceOrder[raceIdx+1])
				raceIdx += 2
				continue
			}
		}

		raceCode := data.RaceOrder[raceIdx]
		if detail == nil || detail.Tables == nil {
			raceIdx++
			continue
		}
		sessions, _ := cache.loadRaceSessions(ev.ID)
		if !eventDetailHasRaceResults(seriesID, detail, sessions) {
			raceIdx++
			continue
		}
		completed = append(completed, raceCode)
		raceIdx++
	}

	if fillCompleted {
		data.CompletedRaces = completed
	}
	if fillStages {
		for i := range data.Rows {
			driver := strings.TrimSpace(data.Rows[i].Driver)
			data.Rows[i].Stages = itoa(stagePointsByDriver[canonicalDriverKey(driver)])
		}
		for i := range data.Ineligible {
			driver := strings.TrimSpace(data.Ineligible[i].Driver)
			data.Ineligible[i].Stages = itoa(stagePointsByDriver[canonicalDriverKey(driver)])
		}
	}
}
