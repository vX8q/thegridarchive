package schedulefile

import (
	"sort"
	"strings"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/driverutil"
	"github.com/vX8q/tga/models"
)

// StripStockCarPartnership drops " with …" tails from stock-car team strings.
func StripStockCarPartnership(name string) string {
	s := strings.TrimSpace(name)
	if s == "" {
		return ""
	}
	lower := strings.ToLower(s)
	if i := strings.Index(lower, " with "); i > 0 {
		return strings.TrimSpace(s[:i])
	}
	return s
}

// TeamRawMatchesCanon reports whether a raw team/constructor string resolves to canonSlug
// via identity or one-hop redirects (built from all distinct entry_list strings).
func TeamRawMatchesCanon(raw, canonSlug string, redirects map[string]string) bool {
	canonSlug = strings.TrimSpace(strings.ToLower(canonSlug))
	if canonSlug == "" {
		return false
	}
	candidates := []string{raw, StripStockCarPartnership(raw)}
	seen := map[string]struct{}{}
	for _, c := range candidates {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		slug := driverutil.Slug(c)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		if slug == canonSlug {
			return true
		}
		if redirects != nil {
			if t := strings.TrimSpace(strings.ToLower(redirects[slug])); t == canonSlug {
				return true
			}
		}
	}
	return false
}

// BuildTeamCareerFromEvents scans events for rows belonging to a canon team org.
// season/seriesFilter empty = all. redirects must include every raw entry_list slug → canon.
func BuildTeamCareerFromEvents(
	dataDir, canonSlug, season, seriesFilter string,
	redirects map[string]string,
) (results []models.TeamSeasonResult, roster []models.TeamRosterSeat, err error) {
	canonSlug = strings.TrimSpace(strings.ToLower(canonSlug))
	if canonSlug == "" {
		return nil, nil, nil
	}
	seriesFilter = strings.TrimSpace(strings.ToLower(seriesFilter))
	season = strings.TrimSpace(season)

	eventStartByID := make(map[string]time.Time)
	rosterKey := map[string]*models.TeamRosterSeat{}
	rosterRounds := map[string]map[int]bool{} // seat key → championship rounds from entry_list

	for _, champ := range config.Championships {
		seriesID := champ.ID
		if seriesFilter != "" && !strings.EqualFold(seriesID, seriesFilter) &&
			!strings.EqualFold(config.DataSeriesID(seriesID), seriesFilter) {
			continue
		}
		events, loadErr := LoadEvents(dataDir, champ.ID)
		if loadErr != nil || len(events) == 0 {
			continue
		}
		seriesName := champ.Name
		dataSID := strings.ToLower(config.DataSeriesID(seriesID))
		roundSets := eventRoundSets(dataSID, events, season)

		for _, ev := range events {
			if season != "" && ev.Season != season {
				continue
			}
			start := parseDateSafe(ev.StartDate)
			if !start.IsZero() && ev.ID != "" {
				eventStartByID[ev.ID] = start
			}
			detail, dErr := LoadEventDetail(dataDir, ev.ID)
			if dErr != nil || detail == nil {
				continue
			}

			eventName := cleanEventName(seriesID, detail.Race)
			if strings.TrimSpace(eventName) == "" {
				eventName = strings.TrimSpace(ev.Name)
			}
			circuitName := strings.TrimSpace(ev.CircuitName)
			if circuitName == "" {
				circuitName = strings.TrimSpace(detail.Track)
			}

			evRounds := roundSets[ev.ID]

			// Roster from entry_list (accumulate rounds across appearances)
			for _, e := range detail.EntryList {
				raw := strings.TrimSpace(e.Team)
				if raw == "" {
					raw = strings.TrimSpace(e.Constructor)
				}
				if !TeamRawMatchesCanon(raw, canonSlug, redirects) {
					continue
				}
				drivers := strings.TrimSpace(e.Driver)
				if drivers == "" {
					parts := make([]string, 0, 3)
					for _, d := range []string{e.Driver1, e.Driver2, e.Driver3} {
						d = strings.TrimSpace(d)
						if d != "" {
							parts = append(parts, d)
						}
					}
					drivers = strings.Join(parts, ", ")
				}
				key := strings.ToLower(seriesID) + "|" + ev.Season + "|" + strings.TrimSpace(e.Number) + "|" + strings.ToLower(drivers)
				if _, ok := rosterKey[key]; !ok {
					rosterKey[key] = &models.TeamRosterSeat{
						SeriesID:   seriesID,
						SeriesName: seriesName,
						Season:     ev.Season,
						CarNumber:  strings.TrimSpace(e.Number),
						DriverName: drivers,
						Class:      strings.TrimSpace(e.Class),
					}
				}
				if len(evRounds) > 0 {
					set := rosterRounds[key]
					if set == nil {
						set = map[int]bool{}
						rosterRounds[key] = set
					}
					for _, r := range evRounds {
						set[r] = true
					}
				}
			}

			if detail.Tables == nil {
				continue
			}

			var mainResults []models.TeamSeasonResult
			var sprintResults []models.TeamSeasonResult

			mainHeaders, mainRows, okMain := tableHeadersRows(detail.Tables, "race_results")
			if okMain {
				mainResults = append(mainResults, parseTeamFromRaceTable(
					seriesID, seriesName, ev.ID, eventName, eventName,
					mainHeaders, mainRows, canonSlug, redirects, ev.Season, circuitName)...)
			} else if h, rws, ok := tableHeadersRows(detail.Tables, "race"); ok {
				mainResults = append(mainResults, parseTeamFromRaceTable(
					seriesID, seriesName, ev.ID, eventName, eventName,
					h, rws, canonSlug, redirects, ev.Season, circuitName)...)
			}

			sessions, sErr := LoadEventRaceSessions(dataDir, ev.ID)
			if sErr == nil && len(sessions) > 0 {
				for _, sess := range sessions {
					titleLower := strings.ToLower(strings.TrimSpace(sess.Title))
					if titleLower == "" {
						continue
					}
					if strings.EqualFold(seriesID, "F1") {
						if !strings.Contains(titleLower, "sprint") {
							continue
						}
					} else if okMain {
						continue
					}
					sprintResults = append(sprintResults, parseTeamFromRaceTable(
						seriesID, seriesName, ev.ID, eventName, sess.Title,
						sess.Headers, sess.Rows, canonSlug, redirects, ev.Season, circuitName)...)
				}
			}

			if strings.EqualFold(seriesID, "F1") {
				results = append(results, sprintResults...)
				results = append(results, mainResults...)
			} else {
				results = append(results, mainResults...)
				results = append(results, sprintResults...)
			}
		}

		for key, set := range rosterRounds {
			if seat := rosterKey[key]; seat != nil && strings.EqualFold(seat.SeriesID, seriesID) {
				if r := compressRounds(set); r != "" {
					seat.Rounds = r
				}
			}
		}

		// Enrich FT/PT + curated rounds from season teams JSON when available
		enrichTeamRosterFullTime(dataDir, seriesID, rosterKey, canonSlug, redirects)
	}

	roster = make([]models.TeamRosterSeat, 0, len(rosterKey))
	for _, s := range rosterKey {
		roster = append(roster, *s)
	}
	sort.Slice(roster, func(i, j int) bool {
		if roster[i].Season != roster[j].Season {
			return roster[i].Season > roster[j].Season
		}
		if roster[i].SeriesID != roster[j].SeriesID {
			return roster[i].SeriesID < roster[j].SeriesID
		}
		if roster[i].CarNumber != roster[j].CarNumber {
			return roster[i].CarNumber < roster[j].CarNumber
		}
		return roster[i].DriverName < roster[j].DriverName
	})

	sort.SliceStable(results, func(i, j int) bool {
		si, sj := eventStartByID[results[i].EventID], eventStartByID[results[j].EventID]
		if !si.Equal(sj) {
			return si.After(sj)
		}
		if results[i].EventID != results[j].EventID {
			return results[i].EventID > results[j].EventID
		}
		return results[i].CarNumber < results[j].CarNumber
	})

	return results, roster, nil
}

// seriesUsesFullTimeFlag reports whether FT/PT is meaningful for the series.
// Allowlist only: stock-car (NASCAR/ARCA) and Supercars. Open-wheel, endurance,
// IndyCar, DTM, etc. use Rounds (and Class where applicable) instead — Go's
// TeamJSON.FullTime zero-value would otherwise force every seat to PT.
// Keep in sync with window.TGA.seriesUsesFullTimeFlag (web/lib/series-stockcar.js).
func seriesUsesFullTimeFlag(seriesID string) bool {
	switch strings.ToLower(config.DataSeriesID(seriesID)) {
	case "nascar_cup", "noaps", "nascar_truck", "arca", "nascar_modified", "supercars":
		return true
	default:
		return false
	}
}

func enrichTeamRosterFullTime(
	dataDir, seriesID string,
	rosterKey map[string]*models.TeamRosterSeat,
	canonSlug string,
	redirects map[string]string,
) {
	dataSID := config.DataSeriesID(seriesID)
	useFT := seriesUsesFullTimeFlag(seriesID)
	// Prefer current season seats; LoadTeamsForSeason needs a season — use each seat's season.
	seasons := map[string]struct{}{}
	for _, s := range rosterKey {
		if strings.EqualFold(s.SeriesID, seriesID) && s.Season != "" {
			seasons[s.Season] = struct{}{}
		}
	}
	for season := range seasons {
		data, err := LoadTeamsForSeason(dataDir, dataSID, season)
		if err != nil || data == nil {
			continue
		}
		// Same enrichment as /api/teams: replace curated placeholders ("1"/"All") with
		// real participation rounds from entry_list.
		EnrichTeamsRoundsFromEvents(dataDir, dataSID, season, data)
		for i := range data.Teams {
			t := &data.Teams[i]
			raw := strings.TrimSpace(t.Team)
			if raw == "" {
				raw = strings.TrimSpace(t.Manufacturer)
			}
			if !TeamRawMatchesCanon(raw, canonSlug, redirects) {
				continue
			}
			driver := strings.TrimSpace(t.Driver)
			if driver == "" && len(t.Drivers) > 0 {
				driver = strings.Join(t.Drivers, ", ")
			}
			key := strings.ToLower(seriesID) + "|" + season + "|" + strings.TrimSpace(t.Number) + "|" + strings.ToLower(driver)
			seat := rosterKey[key]
			if seat == nil {
				// Try match by car number only within season
				for k, s := range rosterKey {
					if s.Season == season && strings.EqualFold(s.SeriesID, seriesID) &&
						s.CarNumber == strings.TrimSpace(t.Number) {
						seat = s
						_ = k
						break
					}
				}
			}
			if seat == nil {
				continue
			}
			// TeamJSON.FullTime is a non-pointer bool; missing JSON becomes false (PT).
			// Only apply for series that actually use FT/PT terminology.
			if useFT {
				ft := t.FullTime
				seat.FullTime = &ft
			}
			if r := strings.TrimSpace(t.Rounds); r != "" {
				seat.Rounds = r
			}
		}
	}
}

func parseTeamFromRaceTable(
	seriesID, seriesName, eventID, eventName, raceName string,
	headers []string, rows [][]string,
	canonSlug string, redirects map[string]string,
	season, circuitName string,
) []models.TeamSeasonResult {
	if len(headers) == 0 || len(rows) == 0 {
		return nil
	}
	colPos := firstColIndex(headers, "Pos", "Fin")
	if colPos < 0 {
		colPos = firstColIndex(headers, "Fin.")
	}
	colDriver := firstColIndex(headers, "Driver", "Drivers", "Driver Name")
	colNo := firstColIndex(headers, "No", "No.", "#", "Car", "Car No", "CAR NO")
	colLaps := firstColIndex(headers, "Laps", "No Laps", "NO LAPS", "Laps Completed")
	colPoints := firstColIndex(headers,
		"Points", "Points.", "Pts", "Pts.", "Pts..",
		"Total Points", "TOTAL POINTS", "Class Points", "CLASS POINTS",
	)
	if colPoints < 0 {
		colPoints = colIndex(headers, "Pts")
	}
	colTimeRetired := firstColIndex(headers, "Time/Retired", "Time / Retired")
	colStatus := firstColIndex(headers, "Status", "Reason", "Notes")
	if colStatus < 0 {
		colStatus = colTimeRetired
	}
	statusFromTime := colTimeRetired >= 0 && colStatus == colTimeRetired
	colClass := firstColIndex(headers, "Class", "Cls")

	if colPos < 0 {
		return nil
	}

	var out []models.TeamSeasonResult
	for _, row := range rows {
		teamName := firstNonEmptyTeamCell(headers, row)
		if strings.EqualFold(seriesID, "IMSA") {
			teamName = imsaTeamFromCell(teamName)
		}
		if !TeamRawMatchesCanon(teamName, canonSlug, redirects) {
			continue
		}
		driver := ""
		if colDriver >= 0 {
			driver = valueAt(row, colDriver)
		}
		posStr := valueAt(row, colPos)
		pos := atoiSafe(posStr)
		classPos := imsaClassPosition(headers, rows, row)
		if strings.EqualFold(seriesID, "IMSA") && classPos > 0 {
			pos = classPos
		}
		laps := 0
		if colLaps >= 0 {
			laps = atoiSafe(valueAt(row, colLaps))
		}
		pts := float64(0)
		if colPoints >= 0 {
			if ps := strings.TrimSpace(valueAt(row, colPoints)); ps != "" && ps != "—" {
				pts = parseFloatLoose(ps)
			}
		}
		status := ""
		if colStatus >= 0 && !(statusFromTime && pos > 0) {
			status = valueAt(row, colStatus)
		}
		if pos == 0 && status == "" && posStr != "" {
			status = posStr
		}
		carNumber := ""
		if colNo >= 0 {
			carNumber = valueAt(row, colNo)
		}
		class := ""
		if colClass >= 0 {
			class = valueAt(row, colClass)
		}
		out = append(out, models.TeamSeasonResult{
			SeriesID:      seriesID,
			SeriesName:    seriesName,
			TeamName:      teamName,
			DriverName:    driver,
			EventID:       eventID,
			EventName:     eventName,
			RaceName:      raceName,
			Season:        season,
			CircuitName:   circuitName,
			Position:      pos,
			ClassPosition: classPos,
			Points:        pts,
			Laps:          laps,
			Status:        status,
			CarNumber:     carNumber,
			Class:         class,
		})
	}
	return out
}

// FilterTeamSeasonResults keeps rows for one season (empty = all).
func FilterTeamSeasonResults(rows []models.TeamSeasonResult, season string) []models.TeamSeasonResult {
	season = strings.TrimSpace(season)
	if season == "" || len(rows) == 0 {
		return rows
	}
	out := make([]models.TeamSeasonResult, 0, len(rows))
	for _, r := range rows {
		if strings.TrimSpace(r.Season) == season {
			out = append(out, r)
		}
	}
	return out
}

// FilterTeamRosterBySeason keeps roster seats for one season (empty = all).
func FilterTeamRosterBySeason(rows []models.TeamRosterSeat, season string) []models.TeamRosterSeat {
	season = strings.TrimSpace(season)
	if season == "" || len(rows) == 0 {
		return rows
	}
	out := make([]models.TeamRosterSeat, 0, len(rows))
	for _, r := range rows {
		if strings.TrimSpace(r.Season) == season {
			out = append(out, r)
		}
	}
	return out
}

// TeamAvailableSeasons returns distinct seasons from results+roster, newest first.
func TeamAvailableSeasons(results []models.TeamSeasonResult, roster []models.TeamRosterSeat) []string {
	seen := map[string]struct{}{}
	for _, r := range results {
		if s := strings.TrimSpace(r.Season); s != "" {
			seen[s] = struct{}{}
		}
	}
	for _, r := range roster {
		if s := strings.TrimSpace(r.Season); s != "" {
			seen[s] = struct{}{}
		}
	}
	out := make([]string, 0, len(seen))
	for s := range seen {
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] > out[j] })
	return out
}
