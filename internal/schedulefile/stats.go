package schedulefile

import (
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/vX8q/tga/config"
)

type statsResultTable struct {
	Title   string
	Headers []string
	Rows    [][]string
}

func statsRaceResultTables(tables map[string]EventTable) []statsResultTable {
	if tables == nil {
		return nil
	}
	if rr, ok := tables["race_results"]; ok && len(rr.Headers) > 0 && len(rr.Rows) > 0 {
		return []statsResultTable{{Title: rr.Title, Headers: rr.Headers, Rows: rr.Rows}}
	}
	if race, ok := tables["race"]; ok && len(race.Headers) > 0 && len(race.Rows) > 0 {
		return []statsResultTable{{Title: race.Title, Headers: race.Headers, Rows: race.Rows}}
	}
	race, ok := tables["race"]
	if !ok || len(race.Sessions) == 0 {
		return nil
	}
	out := make([]statsResultTable, 0, len(race.Sessions))
	for _, session := range race.Sessions {
		if len(session.Headers) == 0 || len(session.Rows) == 0 {
			continue
		}
		out = append(out, statsResultTable(session))
	}
	return out
}

func statsEntryLookup(entries []EntryListRow) (teamByCar, manufacturerByCar, driverByCar, classByCar map[string]string) {
	teamByCar = make(map[string]string)
	manufacturerByCar = make(map[string]string)
	driverByCar = make(map[string]string)
	classByCar = make(map[string]string)
	for _, entry := range entries {
		num := strings.TrimSpace(entry.Number)
		if num == "" {
			continue
		}
		numKeys := statsCarNumberKeys(num)
		setAll := func(dst map[string]string, value string) {
			value = strings.TrimSpace(value)
			if value == "" {
				return
			}
			for key := range numKeys {
				dst[key] = value
			}
		}
		if team := strings.TrimSpace(entry.Team); team != "" {
			setAll(teamByCar, team)
		}
		manufacturer := strings.TrimSpace(entry.Manufacturer)
		if manufacturer == "" {
			manufacturer = strings.TrimSpace(entry.Make)
		}
		if manufacturer == "" {
			manufacturer = strings.TrimSpace(entry.Constructor)
		}
		if manufacturer != "" {
			setAll(manufacturerByCar, manufacturer)
		}
		if className := strings.TrimSpace(entry.Class); className != "" {
			setAll(classByCar, className)
		}
		driver := strings.TrimSpace(entry.Driver)
		if driver == "" {
			var parts []string
			for _, part := range []string{entry.Driver1, entry.Driver2, entry.Driver3} {
				if part = strings.TrimSpace(part); part != "" {
					parts = append(parts, part)
				}
			}
			driver = strings.Join(parts, " / ")
		}
		if driver != "" {
			setAll(driverByCar, strings.Join(strings.Fields(driver), " "))
		}
	}
	return teamByCar, manufacturerByCar, driverByCar, classByCar
}

func statsCarNumberKeys(num string) map[string]struct{} {
	num = strings.TrimSpace(num)
	numKeys := map[string]struct{}{num: {}}
	if n, err := strconv.Atoi(strings.TrimLeft(num, "0")); err == nil {
		plain := strconv.Itoa(n)
		numKeys[plain] = struct{}{}
		if n >= 1 && n <= 9 {
			numKeys[fmt.Sprintf("%02d", n)] = struct{}{}
		}
	}
	return numKeys
}

// statsPSCGuestCars maps entry_list guest car numbers (with # aliases) for stats exclusion.
func statsPSCGuestCars(entries []EntryListRow) map[string]bool {
	out := make(map[string]bool)
	for _, e := range entries {
		if !e.Guest {
			continue
		}
		for key := range statsCarNumberKeys(e.Number) {
			out[key] = true
		}
	}
	return out
}

func statsSessionKind(title string) string {
	title = strings.ToLower(strings.TrimSpace(title))
	if strings.Contains(title, "sprint") {
		return "sprint"
	}
	if strings.Contains(title, "feature") || strings.Contains(title, "grand prix") {
		return "feature"
	}
	return ""
}

func parseStatsPoints(s string) float64 {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", "."))
	if s == "" || s == "—" || s == "-" {
		return 0
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}

func buildDriverStatsClasses(rows []DriverStatsRow, teamCanonByKey map[string]string) []DriverStatsClass {
	byClass := make(map[string][]DriverStatsRow)
	var order []string
	for _, row := range rows {
		className := strings.TrimSpace(row.Class)
		if className == "" {
			continue
		}
		if _, ok := byClass[className]; !ok {
			order = append(order, className)
		}
		byClass[className] = append(byClass[className], row)
	}
	if len(order) <= 1 {
		return nil
	}
	sort.Strings(order)
	out := make([]DriverStatsClass, 0, len(order))
	for _, className := range order {
		rows := byClass[className]
		sort.Slice(rows, func(i, j int) bool {
			if rows[i].Points != rows[j].Points && (rows[i].Points > 0 || rows[j].Points > 0) {
				return rows[i].Points > rows[j].Points
			}
			if rows[i].Wins != rows[j].Wins {
				return rows[i].Wins > rows[j].Wins
			}
			if rows[i].Podiums != rows[j].Podiums {
				return rows[i].Podiums > rows[j].Podiums
			}
			if rows[i].Top5 != rows[j].Top5 {
				return rows[i].Top5 > rows[j].Top5
			}
			return rows[i].Driver < rows[j].Driver
		})
		out = append(out, DriverStatsClass{
			ID:            strings.ToLower(strings.ReplaceAll(className, " ", "-")),
			Name:          className,
			Rows:          rows,
			Teams:         aggregateByTeam(rows, teamCanonByKey),
			Manufacturers: aggregateByManufacturer(rows),
		})
	}
	return out
}

// statsIsDNF counts retirements from an explicit status / Time-Retired cell only.
// Lapped finishers (empty Status, or "+1 lap" / race time in Time/Retired) are not DNFs.
func statsIsDNF(status string, _ /*laps*/, _ /*raceLaps*/ int) bool {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "" || status == "—" || status == "-" {
		return false
	}
	switch status {
	case "running", "classified", "finished", "running at finish":
		return false
	}
	// Classified finishes written into Time/Retired-style columns.
	if strings.HasPrefix(status, "+") {
		return false
	}
	if looksLikeRaceTimeOrGap(status) {
		return false
	}
	return true
}

// statsIsDNFPos treats explicit non-finish Pos labels as DNF when Status is absent.
func statsIsDNFPos(rawPosCell string) bool {
	switch strings.ToLower(normalizeStatsRacePos(rawPosCell)) {
	case "dnf", "dns", "dsq", "dq", "ret", "retired", "wd", "wth":
		return true
	default:
		return false
	}
}

func looksLikeRaceTimeOrGap(s string) bool {
	hasDigit := false
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			hasDigit = true
		case r == ':' || r == '.' || r == ' ' || r == ',':
			// ok
		default:
			return false
		}
	}
	return hasDigit
}

// statsPosColIndex finds finish-position columns including FREC-style "Fin / ST".
func statsPosColIndex(headers []string) int {
	if i := firstColIndex(headers, "Pos", "Fin", "Position", "POS"); i >= 0 {
		return i
	}
	for i, h := range headers {
		n := strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(n, "fin") && strings.Contains(n, "st") {
			return i
		}
	}
	return -1
}

// normalizeStatsRacePos mirrors standings: "1 / ST 2 ▲1" → "1", "NC / ST 28" → "NC".
func normalizeStatsRacePos(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "/") {
		s = strings.TrimSpace(strings.SplitN(s, "/", 2)[0])
	}
	return s
}

// parseStatsStartFromFinST extracts grid from "1 / ST 11 ▲10" when there is no Grid column.
func parseStatsStartFromFinST(raw string) int {
	upper := strings.ToUpper(raw)
	idx := strings.Index(upper, "ST")
	if idx < 0 {
		return 0
	}
	rest := strings.TrimSpace(raw[idx+2:])
	if rest == "" {
		return 0
	}
	end := 0
	for end < len(rest) && rest[end] >= '0' && rest[end] <= '9' {
		end++
	}
	if end == 0 {
		return 0
	}
	return atoiSafe(rest[:end])
}

func statsPoleCars(seriesID string, tables map[string]EventTable, resultTables []statsResultTable) []map[string]bool {
	out := make([]map[string]bool, len(resultTables))
	starts := statsQualStartByCar(seriesID, tables, resultTables)
	for i := 0; i < len(resultTables); i++ {
		for car, pos := range starts[i] {
			if pos == 1 {
				if out[i] == nil {
					out[i] = make(map[string]bool)
				}
				out[i][car] = true
			}
		}
	}
	return out
}

// statsQualSessionIndex chooses which qualifying session feeds race session raceIdx.
// Rules:
//   - F1/F2/F3 Sprint never inherits flat qualifying (reverse / separate grid).
//   - A single Q table maps only to Feature / GP (or the sole non-sprint race).
//   - Multiple Q sessions map 1:1 by index; never wrap to session 0 (avoids double poles).
func statsQualSessionIndex(seriesID string, sessions []RaceSession, resultTables []statsResultTable, raceIdx int) int {
	if len(sessions) == 0 || raceIdx < 0 || raceIdx >= len(resultTables) {
		return -1
	}
	kind := statsSessionKind(resultTables[raceIdx].Title)
	sprintFeature := isSprintFeatureSeriesID(seriesID)
	if sprintFeature && kind == "sprint" {
		return -1
	}
	if len(sessions) == 1 {
		if sprintFeature {
			if kind == "feature" {
				return 0
			}
			// Lone "Race" / GP-style title on a weekend that also has a Sprint: treat as feature.
			hasSprint := false
			for _, rt := range resultTables {
				if statsSessionKind(rt.Title) == "sprint" {
					hasSprint = true
					break
				}
			}
			if hasSprint {
				return 0
			}
			// Single race weekend with one Q.
			return 0
		}
		// Non-sprint multi-race (e.g. DTM): only the first race reuses a lone Q.
		if raceIdx == 0 {
			return 0
		}
		return -1
	}
	if raceIdx < len(sessions) {
		return raceIdx
	}
	return -1
}

// statsQualStartByCar maps car number → qualifying position per race-session index.
// When race tables lack a Grid column, stats uses this (and Fin/ST) for avg start.
func statsQualStartByCar(seriesID string, tables map[string]EventTable, resultTables []statsResultTable) []map[string]int {
	out := make([]map[string]int, len(resultTables))
	var sessions []RaceSession
	if q, ok := tables["qualifying"]; ok {
		if len(q.Sessions) > 0 {
			sessions = make([]RaceSession, 0, len(q.Sessions))
			for _, session := range q.Sessions {
				sessions = append(sessions, RaceSession(session))
			}
		} else if len(q.Headers) > 0 && len(q.Rows) > 0 {
			sessions = []RaceSession{{Title: q.Title, Headers: q.Headers, Rows: q.Rows}}
		}
	}
	for i := range resultTables {
		srcIdx := statsQualSessionIndex(seriesID, sessions, resultTables, i)
		if srcIdx < 0 || srcIdx >= len(sessions) {
			continue
		}
		s := sessions[srcIdx]
		posCol := statsPosColIndex(s.Headers)
		if posCol < 0 {
			posCol = firstColIndex(s.Headers, "Pos", "Position")
		}
		noCol := firstColIndex(s.Headers, "No", "No.", "#", "Car No", "CAR NO", "Car")
		if posCol < 0 || noCol < 0 {
			continue
		}
		m := make(map[string]int)
		for _, row := range s.Rows {
			raw := valueAt(row, posCol)
			posStr := normalizeStatsRacePos(raw)
			pos := atoiSafe(posStr)
			if pos <= 0 {
				continue
			}
			car := valueAt(row, noCol)
			if car == "" {
				continue
			}
			if _, exists := m[car]; !exists {
				m[car] = pos
			}
		}
		out[i] = m
	}
	return out
}

// statsClassifiedFinishPos returns a numeric finishing position only for classified results.
// Non-numeric Pos (DNF, NC, Ret, …) must not inflate avg finish / top-N via row index.
func statsClassifiedFinishPos(rawPosCell string) (pos int, classified bool) {
	posStr := normalizeStatsRacePos(rawPosCell)
	if posStr == "" || !isAllDigits(posStr) {
		return 0, false
	}
	pos = atoiSafe(posStr)
	if pos <= 0 {
		return 0, false
	}
	return pos, true
}

// buildDriverStatsFromJSON builds DriverStatsData from JSON (events + details with race_results/stage1/stage2).
// Used as fallback when DB is empty or unused.
func buildDriverStatsFromJSON(dataDir string, seriesID string, season string) (*DriverStatsData, error) {
	// Supercars uses a separate parser because JSON format differs (race.sessions instead of race_results).
	if strings.EqualFold(seriesID, "SUPERCARS") {
		return buildSupercarsDriverStatsFromJSON(dataDir, season)
	}
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, seriesID)
	if err != nil {
		log.Printf("stats JSON fallback %s: LoadEvents failed: %v", seriesID, err)
		return &DriverStatsData{Rows: []DriverStatsRow{}, Teams: []TeamStatsRow{}, Manufacturers: []ManufacturerStatsRow{}}, nil
	}
	if len(events) == 0 {
		path := filepath.Join(dataDir, "schedules", strings.ToLower(seriesID)+".json")
		log.Printf("stats JSON fallback %s: no events (file missing or empty? path=%s)", seriesID, path)
		return &DriverStatsData{Rows: []DriverStatsRow{}, Teams: []TeamStatsRow{}, Manufacturers: []ManufacturerStatsRow{}}, nil
	}
	today := time.Now().Format("2006-01-02")
	eventsWithResults := 0
	// IndyCar manufacturer is engine brand by car number from Teams.
	var indyEngineByCar map[string]string
	if strings.EqualFold(seriesID, "INDYCAR") {
		if teams, err := LoadTeams(dataDir, seriesID); err == nil && teams != nil {
			m := make(map[string]string)
			for _, t := range teams.Teams {
				num := strings.TrimSpace(t.Number)
				if num == "" {
					continue
				}
				engine := strings.TrimSpace(t.Manufacturer)
				if engine == "" {
					continue
				}
				m[num] = engine
			}
			if len(m) > 0 {
				indyEngineByCar = m
			}
		}
	}

	type driverAcc struct {
		driver         string
		team           string
		manufacturer   string
		class          string
		car            string
		races          int
		wins           int
		points         float64
		top2           int
		top3           int
		poles          int
		fastestLaps    int
		bestLap        string
		dnfs           int
		sprintWins     int
		sprintPodiums  int
		featureWins    int
		featurePodiums int
		top5           int
		top10          int
		top15          int
		top20          int
		sumFinish      float64
		finishCnt      int
		sumStart       float64
		startCnt       int
		sumLaps        int
		totalLaps      int
		sumPosDiff     float64
		posDiffCnt     int
		stageWins      int
		stagePoints    int
		lapsLed        int
	}
	byDriver := make(map[string]*driverAcc)

	for _, e := range events {
		if e.Season != season {
			continue
		}
		if skipChampionshipMetricsEvent(seriesID, e.ID) {
			continue
		}
		if isFutureScheduleEvent(e, today) {
			continue
		}
		detail, err := LoadEventDetail(dataDir, e.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		resultTables := statsRaceResultTables(detail.Tables)
		if len(resultTables) == 0 {
			continue
		}
		eventsWithResults++
		entryTeamByCar, entryManufacturerByCar, entryDriverByCar, entryClassByCar := statsEntryLookup(detail.EntryList)
		poleCarsBySession := statsPoleCars(seriesID, detail.Tables, resultTables)
		qualStartBySession := statsQualStartByCar(seriesID, detail.Tables, resultTables)
		useStockCarStageRules := stockCarSeriesUsesStagePoints(seriesID)
		var eligibleByCar map[string]bool
		if useStockCarStageRules {
			eligibleByCar = pointsEligibleByCarFromEntryList(detail.EntryList)
		}
		guestByCar := map[string]bool{}
		if strings.EqualFold(seriesID, "PSC") {
			guestByCar = statsPSCGuestCars(detail.EntryList)
		}
		stageWinsThisRace, stagePointsThisRace := accumulateStageStatsPerRace(seriesID, detail, eligibleByCar, useStockCarStageRules)
		for rtIdx, rt := range resultTables {
			sessionKind := statsSessionKind(rt.Title)
			colPos := statsPosColIndex(rt.Headers)
			colGrid := firstColIndex(rt.Headers, "Grid", "St", "Start", "Started", "Start Pos")
			colNo := firstColIndex(rt.Headers, "No", "No.", "#", "Car No", "CAR NO", "Car")
			colDriver := firstColIndex(rt.Headers, "Driver", "Drivers", "Driver(s)")
			// Open-wheel series in event JSON often use "Constructor" instead of "Team".
			// Endurance/touring tables may use entrant-style labels.
			colTeam := firstColIndex(rt.Headers, "Team", "Constructor", "Entrant", "TEAM/CAR/SPONSOR")
			colManu := firstColIndex(rt.Headers, "Manufacturer", "Chassis", "Make", "Engine")
			colClass := firstColIndex(rt.Headers, "Class")
			colLaps := firstColIndex(rt.Headers, "Laps", "No Laps", "NO LAPS")
			colLed := firstColIndex(rt.Headers, "Led", "Laps Led")
			colPts := firstColIndex(rt.Headers, "Points", "Pts", "DP", "TP")
			colStatus := firstColIndex(rt.Headers, "Status", "Time / status", "Time/Status", "Time/Retired", "Time / Retired")
			colBest := firstColIndex(rt.Headers, "Best", "Best lap", "Fastest Lap", "FASTEST LAP")
			// ELMS-style results: Team/No/Class only — resolve drivers from entry_list.
			if colDriver < 0 && len(entryDriverByCar) == 0 {
				continue
			}
			raceLaps := 0
			for _, row := range rt.Rows {
				if l := atoiSafe(valueAt(row, colLaps)); l > raceLaps {
					raceLaps = l
				}
			}
			if raceLaps == 0 && detail.Laps != "" {
				raceLaps = atoiSafe(detail.Laps)
			}
			fastestRow := -1
			bestLap := ""
			if colBest >= 0 {
				for i, row := range rt.Rows {
					lap := valueAt(row, colBest)
					if lap == "" || lap == "—" || lap == "-" {
						continue
					}
					if bestLap == "" || betterLap(bestLap, lap) == lap {
						bestLap = lap
						fastestRow = i
					}
				}
			}
			for rowIdx, row := range rt.Rows {
				carNumber := valueAt(row, colNo)
				if guestByCar[carNumber] {
					continue
				}
				driverName := ""
				if colDriver >= 0 {
					driverName = valueAt(row, colDriver)
				}
				if entryDriverByCar[carNumber] != "" && (driverName == "" || strings.Contains(driverName, ".")) {
					driverName = entryDriverByCar[carNumber]
				}
				// F1: normalize Carlos Sainz -> Carlos Sainz Jr.
				if strings.EqualFold(seriesID, "F1") && strings.TrimSpace(driverName) == "Carlos Sainz" {
					driverName = "Carlos Sainz Jr."
				}
				driverName = preferredDriverName(driverName)
				if driverName == "" {
					continue
				}
				teamName := valueAt(row, colTeam)
				if teamName == "" {
					teamName = entryTeamByCar[carNumber]
				}
				manufacturer := valueAt(row, colManu)
				if manufacturer == "" {
					manufacturer = entryManufacturerByCar[carNumber]
				}
				if manufacturer == "" && indyEngineByCar != nil && carNumber != "" {
					if eng, ok := indyEngineByCar[carNumber]; ok {
						manufacturer = eng
					}
				}
				className := valueAt(row, colClass)
				if className == "" {
					className = entryClassByCar[carNumber]
				}
				rawPosCell := ""
				if colPos >= 0 {
					rawPosCell = valueAt(row, colPos)
				}
				pos, classified := statsClassifiedFinishPos(rawPosCell)
				grid := 0
				if colGrid >= 0 {
					grid = atoiSafe(valueAt(row, colGrid))
				} else if rawPosCell != "" {
					grid = parseStatsStartFromFinST(rawPosCell)
				}
				if grid <= 0 && carNumber != "" && rtIdx < len(qualStartBySession) && qualStartBySession[rtIdx] != nil {
					grid = qualStartBySession[rtIdx][carNumber]
				}
				laps := atoiSafe(valueAt(row, colLaps))
				led := 0
				if colLed >= 0 {
					led = atoiSafe(valueAt(row, colLed))
				}
				points := parseStatsPoints(valueAt(row, colPts))
				status := valueAt(row, colStatus)
				driverKey := canonicalDriverKey(driverName) + "\t" + carNumber
				if byDriver[driverKey] == nil {
					byDriver[driverKey] = &driverAcc{
						driver: driverName, team: teamName, manufacturer: manufacturer, class: className, car: carNumber,
					}
				}
				acc := byDriver[driverKey]
				if acc.team == "" {
					acc.team = teamName
				}
				if acc.manufacturer == "" {
					acc.manufacturer = manufacturer
				}
				if acc.class == "" {
					acc.class = className
				}
				// Count a start only if the driver actually ran (at least one lap).
				didStart := laps > 0
				if !didStart && colLaps < 0 {
					if classified {
						didStart = true
					}
				}
				if didStart {
					acc.races++
				}
				if (colGrid >= 0 && grid == 1) || (colGrid < 0 && rtIdx < len(poleCarsBySession) && poleCarsBySession[rtIdx] != nil && poleCarsBySession[rtIdx][carNumber]) {
					acc.poles++
				}
				if classified && pos == 1 {
					acc.wins++
					if sessionKind == "sprint" {
						acc.sprintWins++
					} else if sessionKind == "feature" {
						acc.featureWins++
					}
				}
				if classified && pos == 2 {
					acc.top2++
				}
				if classified && pos == 3 {
					acc.top3++
				}
				if classified && pos >= 1 && pos <= 3 {
					if sessionKind == "sprint" {
						acc.sprintPodiums++
					} else if sessionKind == "feature" {
						acc.featurePodiums++
					}
				}
				if classified && pos >= 1 && pos <= 5 {
					acc.top5++
				}
				if classified && pos >= 1 && pos <= 10 {
					acc.top10++
				}
				if classified && pos >= 1 && pos <= 15 {
					acc.top15++
				}
				if classified && pos >= 1 && pos <= 20 {
					acc.top20++
				}
				// Average finish: classified finishers only (not DNF/NC via row order).
				if didStart && classified && pos > 0 {
					acc.sumFinish += float64(pos)
					acc.finishCnt++
				}
				if grid > 0 {
					acc.sumStart += float64(grid)
					acc.startCnt++
				}
				acc.sumLaps += laps
				acc.totalLaps += raceLaps
				if grid > 0 && classified && pos > 0 {
					acc.sumPosDiff += float64(grid - pos)
					acc.posDiffCnt++
				}
				acc.stageWins += stageWinsThisRace[driverKey]
				acc.stagePoints += stagePointsThisRace[driverKey]
				acc.lapsLed += led
				acc.points += points
				if rowIdx == fastestRow {
					acc.fastestLaps++
					acc.bestLap = betterLap(acc.bestLap, bestLap)
				}
				if statsIsDNF(status, laps, raceLaps) || statsIsDNFPos(rawPosCell) {
					acc.dnfs++
				}
			}
		}
	}
	if eventsWithResults == 0 && len(events) > 0 {
		log.Printf("stats JSON fallback %s: %d events loaded but none had race_results (check data/events/%s*.json)", seriesID, len(events), strings.ToLower(seriesID))
	}
	if eventsWithResults > 0 {
		log.Printf("stats JSON fallback %s: %d events with results, %d drivers", seriesID, eventsWithResults, len(byDriver))
	}
	var out []DriverStatsRow
	for _, a := range byDriver {
		avgFinish := 0.0
		if a.finishCnt > 0 && a.sumFinish > 0 {
			avgFinish = a.sumFinish / float64(a.finishCnt)
		}
		avgStart := 0.0
		if a.startCnt > 0 && a.sumStart > 0 {
			avgStart = a.sumStart / float64(a.startCnt)
		}
		lapsPct := 0.0
		if a.totalLaps > 0 {
			lapsPct = 100.0 * float64(a.sumLaps) / float64(a.totalLaps)
		}
		posDiff := 0.0
		if a.posDiffCnt > 0 {
			posDiff = a.sumPosDiff / float64(a.posDiffCnt)
		}
		avgStagePoints := 0.0
		if a.races > 0 {
			avgStagePoints = float64(a.stagePoints) / float64(a.races)
		}
		out = append(out, DriverStatsRow{
			Driver:           a.driver,
			Team:             a.team,
			Manufacturer:     a.manufacturer,
			Class:            a.class,
			Car:              a.car,
			Races:            a.races,
			Wins:             a.wins,
			Points:           roundTo(a.points, 2),
			Top2:             a.top2,
			Top3:             a.top3,
			Podiums:          a.wins + a.top2 + a.top3,
			Poles:            a.poles,
			Top5:             a.top5,
			Top10:            a.top10,
			Top15:            a.top15,
			Top20:            a.top20,
			FastestLaps:      a.fastestLaps,
			BestLap:          a.bestLap,
			DNFs:             a.dnfs,
			SprintWins:       a.sprintWins,
			SprintPodiums:    a.sprintPodiums,
			FeatureWins:      a.featureWins,
			FeaturePodiums:   a.featurePodiums,
			AvgFinish:        roundTo(avgFinish, 2),
			AvgStart:         roundTo(avgStart, 2),
			StageWins:        a.stageWins,
			StagePoints:      a.stagePoints,
			AvgStagePoints:   roundTo(avgStagePoints, 2),
			LapsLed:          a.lapsLed,
			LapsCompleted:    a.sumLaps,
			LapsCompletedPct: roundTo(lapsPct, 1),
			PositionDiff:     roundTo(posDiff, 2),
		})
	}
	if isStockCarStatsSeries(seriesID) {
		sort.Slice(out, func(i, j int) bool {
			return stockCarDriverStatsRowLess(out[i], out[j])
		})
	} else {
		sort.Slice(out, func(i, j int) bool {
			return defaultDriverStatsRowLess(seriesID, out[i], out[j])
		})
	}

	// F1: also load manufacturer, Q2/Q3, and average qualifying.
	var f1Qual map[string]q2q3Count
	if strings.EqualFold(seriesID, "F1") {
		// Manufacturer from teams/f1.json.
		if teamsData, err := LoadTeams(dataDir, "f1"); err == nil && teamsData != nil && len(teamsData.Teams) > 0 {
			byDriverCar := make(map[string]string)
			byDriver := make(map[string]string)
			byCar := make(map[string]string)
			for _, t := range teamsData.Teams {
				driverKey := strings.TrimSpace(strings.ToLower(t.Driver))
				num := strings.TrimSpace(t.Number)
				man := strings.TrimSpace(t.Manufacturer)
				if man == "" {
					continue
				}
				if driverKey != "" || num != "" {
					key := driverKey + "|" + num
					byDriverCar[key] = man
				}
				if driverKey != "" {
					byDriver[driverKey] = man
				}
				if num != "" {
					byCar[num] = man
				}
			}
			for i := range out {
				if strings.TrimSpace(out[i].Manufacturer) != "" {
					continue
				}
				driverKey := strings.TrimSpace(strings.ToLower(out[i].Driver))
				carNum := strings.TrimSpace(out[i].Car)
				key := driverKey + "|" + carNum
				if man := byDriverCar[key]; man != "" {
					out[i].Manufacturer = man
				} else if man := byCar[carNum]; man != "" {
					out[i].Manufacturer = man
				} else if man := byDriver[driverKey]; man != "" {
					out[i].Manufacturer = man
				}
			}
		}
		// Q2/Q3 and avg_qualifying from qualifying.
		if q2q3, err := loadF1QualifyingQ2Q3Passes(dataDir, season); err == nil && len(q2q3) > 0 {
			f1Qual = q2q3
			for i := range out {
				key := strings.TrimSpace(strings.ToLower(out[i].Driver))
				if v, ok := q2q3[key]; ok {
					out[i].Q2Passes = v.Q2
					out[i].Q3Passes = v.Q3
					if v.Count > 0 {
						out[i].AvgQualifying = roundTo(v.SumPos/float64(v.Count), 2)
					}
				}
			}
		}
	}

	// Formula series (F1/F2/F3): merge duplicate rows for one driver:
	// team/chassis spelling may differ across events, but stats page
	// should show one row per driver.
	if strings.EqualFold(seriesID, "F1") || strings.EqualFold(seriesID, "F2") || strings.EqualFold(seriesID, "F3") {
		out = mergeOpenWheelDriverStatsRows(out)
		// After mergeOpenWheelDriverStatsRows do not sum poles across duplicates,
		// so for F1 we set poles in a separate pass.
		if strings.EqualFold(seriesID, "F1") && f1Qual != nil && len(f1Qual) > 0 {
			for i := range out {
				key := strings.TrimSpace(strings.ToLower(out[i].Driver))
				if v, ok := f1Qual[key]; ok {
					out[i].Poles = v.Poles
				}
			}
		}
	}
	// For stock-car Team Stats keep original rows before merge,
	// so different teams for one driver are not glued into "A / B".
	teamSourceRows := out
	// Stock-car: also merge one driver's duplicates into one row.
	// Unlike open-wheel, different numbers/teams per season are possible,
	// so mergeStockCarDriverStatsRows joins Car and Team with " / ".
	if strings.EqualFold(seriesID, "NASCAR_CUP") ||
		strings.EqualFold(seriesID, "NOAPS") ||
		strings.EqualFold(seriesID, "NASCAR_TRUCK") ||
		strings.EqualFold(seriesID, "ARCA") ||
		strings.EqualFold(seriesID, "NASCAR_MODIFIED") {
		teamSourceRows = append([]DriverStatsRow(nil), out...)
		out = mergeStockCarDriverStatsRows(out)
		enrichStockCarDriverStatsCars(dataDir, seriesID, season, out)
	}

	mans := aggregateByManufacturer(out)
	teamCanon := teamCanonByFoldKeyForStats(dataDir, seriesID)
	teams := aggregateByTeam(teamSourceRows, teamCanon)

	return &DriverStatsData{Rows: out, Teams: teams, Manufacturers: mans, Classes: buildDriverStatsClasses(out, teamCanon)}, nil
}

func supercarsStatsDriverName(driver string) string {
	return preferredDriverName(driver)
}

func supercarsStatsAccKey(driver, car string) string {
	return canonicalDriverKey(supercarsStatsDriverName(driver)) + "\t" + SupercarsCarToCanonical(car)
}

// buildSupercarsDriverStatsFromJSON builds Supercars driver stats from JSON,
// using race.sessions tables (Race 1–3, etc.).
func buildSupercarsDriverStatsFromJSON(dataDir string, season string) (*DriverStatsData, error) {
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, "SUPERCARS")
	if err != nil || len(events) == 0 {
		return &DriverStatsData{Rows: []DriverStatsRow{}, Teams: []TeamStatsRow{}, Manufacturers: []ManufacturerStatsRow{}}, nil
	}

	// Maps number → manufacturer and number → team from Teams.
	// Normalize keys: raw string, strip leading zeros, zero-pad to 2 chars (as EnrichSupercarsEvent),
	// to match "07"/"7"/"07" formats.
	engineByCar := make(map[string]string)
	teamByCar := make(map[string]string)
	if teams, err := LoadTeams(dataDir, "SUPERCARS"); err == nil && teams != nil {
		for _, t := range teams.Teams {
			rawNum := strings.TrimSpace(t.Number)
			if rawNum == "" {
				continue
			}
			engine := strings.TrimSpace(t.Manufacturer)
			team := strings.TrimSpace(t.Team)

			// Normalize number keys.
			numVariants := make(map[string]struct{})
			numVariants[rawNum] = struct{}{}
			if n, err := strconv.Atoi(strings.TrimLeft(rawNum, "0")); err == nil {
				numInt := strconv.Itoa(n)
				numVariants[numInt] = struct{}{}
				if n >= 1 && n <= 9 {
					numVariants[fmt.Sprintf("%02d", n)] = struct{}{}
				}
			}

			for num := range numVariants {
				if engine != "" {
					engineByCar[num] = engine
				}
				if team != "" {
					teamByCar[num] = team
				}
			}
		}
	}

	type acc struct {
		driver    string
		team      string
		engine    string
		car       string
		races     int
		wins      int
		top5      int
		top10     int
		sumFinish float64
		finishCnt int
		// Supercars race.sessions lack explicit start position, so
		// sumStart/posDiffCount hold qualifying positions (avg qualifying column).
		sumStart     float64
		posDiffCount int
	}
	byKey := make(map[string]*acc)

	for _, e := range events {
		if e.Season != season {
			continue
		}
		raw, err := ReadEventDetailFile(dataDir, e.ID)
		if err != nil {
			continue
		}
		var root map[string]interface{}
		if err := json.Unmarshal(raw, &root); err != nil {
			continue
		}
		tables, ok := root["tables"].(map[string]interface{})
		if !ok {
			continue
		}
		raceAny, ok := tables["race"]
		if ok {
			raceMap, ok := raceAny.(map[string]interface{})
			if ok {
				sessionsAny, ok := raceMap["sessions"].([]interface{})
				if ok {
					for _, sessAny := range sessionsAny {
						sessMap, ok := sessAny.(map[string]interface{})
						if !ok {
							continue
						}
						headersAny, ok := sessMap["headers"].([]interface{})
						if !ok {
							continue
						}
						var headers []string
						for _, h := range headersAny {
							headers = append(headers, strings.TrimSpace(fmt.Sprint(h)))
						}
						rowsAny, ok := sessMap["rows"].([]interface{})
						if !ok {
							continue
						}
						colPos := firstColIndex(headers, "Pos", "Fin")
						colNo := firstColIndex(headers, "No", "No.", "#", "Car")
						colDriver := firstColIndex(headers, "Driver")
						colTeam := firstColIndex(headers, "Team")
						if colDriver < 0 || colPos < 0 {
							continue
						}
						for _, rAny := range rowsAny {
							rSlice, ok := rAny.([]interface{})
							if !ok {
								continue
							}
							row := make([]string, len(rSlice))
							for i := range rSlice {
								row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
							}
							posStr := valueAt(row, colPos)
							pos, classified := statsClassifiedFinishPos(posStr)
							isNC := strings.EqualFold(strings.TrimSpace(posStr), "NC")
							// NC still counts as a start; other non-numeric Pos rows are skipped.
							if !classified && !isNC {
								continue
							}
							driver := supercarsStatsDriverName(valueAt(row, colDriver))
							if driver == "" {
								continue
							}
							car := SupercarsCarToCanonical(valueAt(row, colNo))
							team := ""
							if colTeam >= 0 {
								team = valueAt(row, colTeam)
							}
							engine := ""
							if car != "" {
								engine = engineByCar[car]
								// Team and manufacturer names always from Teams (as on /series/supercars/teams).
								if tName, ok := teamByCar[car]; ok && tName != "" {
									team = tName
								}
							}
							key := supercarsStatsAccKey(driver, car)
							a := byKey[key]
							if a == nil {
								a = &acc{driver: driver, team: team, engine: engine, car: car}
								byKey[key] = a
							}
							if a.team == "" {
								a.team = team
							}
							if a.engine == "" {
								a.engine = engine
							}
							a.races++
							if !classified {
								continue
							}
							if pos == 1 {
								a.wins++
							}
							if pos >= 1 && pos <= 5 {
								a.top5++
							}
							if pos >= 1 && pos <= 10 {
								a.top10++
							}
							a.sumFinish += float64(pos)
							a.finishCnt++
						}
					}
				}
			}
		}

		eventQualAdds := 0
		// Avg. Qualifying from qualifying sessions (primary); starting_lineup only if no qualifying in event.
		if qualAny, ok := tables["qualifying"]; ok {
			qualMap, ok := qualAny.(map[string]interface{})
			if ok {
				accumulateSupercarsQualSession := func(headers []string, rowsAny []interface{}) {
					colPos := firstColIndex(headers, "Pos")
					colNo := firstColIndex(headers, "No", "No.", "#", "Car")
					colDriver := firstColIndex(headers, "Driver")
					colTeam := firstColIndex(headers, "Team")
					if colDriver < 0 || colPos < 0 {
						return
					}
					for _, rAny := range rowsAny {
						rSlice, ok := rAny.([]interface{})
						if !ok {
							continue
						}
						row := make([]string, len(rSlice))
						for i := range rSlice {
							row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
						}
						pos := atoiSafe(valueAt(row, colPos))
						if pos <= 0 {
							continue
						}
						driver := supercarsStatsDriverName(valueAt(row, colDriver))
						if driver == "" {
							continue
						}
						car := SupercarsCarToCanonical(valueAt(row, colNo))
						team := ""
						if colTeam >= 0 {
							team = valueAt(row, colTeam)
						}
						engine := ""
						if car != "" {
							engine = engineByCar[car]
							if tName, ok := teamByCar[car]; ok && tName != "" {
								team = tName
							}
						}
						key := supercarsStatsAccKey(driver, car)
						a := byKey[key]
						if a == nil {
							continue
						}
						if a.team == "" {
							a.team = team
						}
						if a.engine == "" {
							a.engine = engine
						}
						a.sumStart += float64(pos)
						a.posDiffCount++
						eventQualAdds++
					}
				}
				if sessListAny, ok := qualMap["sessions"]; ok {
					if sessSlice, ok := sessListAny.([]interface{}); ok {
						for _, sessAny := range sessSlice {
							sessMap, ok := sessAny.(map[string]interface{})
							if !ok {
								continue
							}
							headersAny, ok := sessMap["headers"].([]interface{})
							if !ok {
								continue
							}
							var headers []string
							for _, h := range headersAny {
								headers = append(headers, strings.TrimSpace(fmt.Sprint(h)))
							}
							rowsAny, ok := sessMap["rows"].([]interface{})
							if !ok {
								continue
							}
							accumulateSupercarsQualSession(headers, rowsAny)
						}
					}
				} else if headersAny, ok := qualMap["headers"].([]interface{}); ok {
					var headers []string
					for _, h := range headersAny {
						headers = append(headers, strings.TrimSpace(fmt.Sprint(h)))
					}
					if rowsAny, ok := qualMap["rows"].([]interface{}); ok {
						accumulateSupercarsQualSession(headers, rowsAny)
					}
				}
			}
		}

		if eventQualAdds == 0 {
			if slAny, ok := tables["starting_lineup"]; ok {
				if slMap, ok := slAny.(map[string]interface{}); ok {
					if sessList, ok := slMap["sessions"].([]interface{}); ok {
						for _, sessAny := range sessList {
							sessMap, ok := sessAny.(map[string]interface{})
							if !ok {
								continue
							}
							headersAny, ok := sessMap["headers"].([]interface{})
							if !ok {
								continue
							}
							var headers []string
							for _, h := range headersAny {
								headers = append(headers, strings.TrimSpace(fmt.Sprint(h)))
							}
							rowsAny, ok := sessMap["rows"].([]interface{})
							if !ok {
								continue
							}
							colPos := firstColIndex(headers, "Pos", "Fin")
							colNo := firstColIndex(headers, "No", "No.", "#", "Car")
							colDriver := firstColIndex(headers, "Driver")
							if colPos < 0 || colDriver < 0 {
								continue
							}
							for _, rAny := range rowsAny {
								rSlice, ok := rAny.([]interface{})
								if !ok {
									continue
								}
								row := make([]string, len(rSlice))
								for i := range rSlice {
									row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
								}
								pos := atoiSafe(valueAt(row, colPos))
								if pos <= 0 {
									continue
								}
								driver := supercarsStatsDriverName(valueAt(row, colDriver))
								if driver == "" {
									continue
								}
								car := SupercarsCarToCanonical(valueAt(row, colNo))
								a := byKey[supercarsStatsAccKey(driver, car)]
								if a == nil {
									continue
								}
								a.sumStart += float64(pos)
								a.posDiffCount++
							}
						}
					}
				}
			}
		}
	}

	var rows []DriverStatsRow
	for _, a := range byKey {
		if a.races == 0 {
			continue
		}
		avgFinish := 0.0
		if a.finishCnt > 0 && a.sumFinish > 0 {
			avgFinish = a.sumFinish / float64(a.finishCnt)
		}
		avgStart := 0.0
		if a.sumStart > 0 && a.posDiffCount > 0 {
			avgStart = a.sumStart / float64(a.posDiffCount)
		}
		rows = append(rows, DriverStatsRow{
			Driver:           a.driver,
			Team:             a.team,
			Manufacturer:     a.engine,
			Car:              a.car,
			Races:            a.races,
			Wins:             a.wins,
			Top5:             a.top5,
			Top10:            a.top10,
			AvgStart:         roundTo(avgStart, 2),
			QualAppearances:  a.posDiffCount,
			AvgFinish:        roundTo(avgFinish, 2),
		})
	}
	// Merge duplicates: one driver may be spelled differently across events (Matthew Payne / Matt Payne).
	// Group by canonical car number and merge stats.
	rows = mergeSupercarsStatsRowsByCar(rows)
	sort.Slice(rows, func(i, j int) bool {
		return defaultDriverStatsRowLess("SUPERCARS", rows[i], rows[j])
	})

	mans := aggregateByManufacturer(rows)
	teams := aggregateByTeam(rows, nil)

	return &DriverStatsData{Rows: rows, Teams: teams, Manufacturers: mans}, nil
}

// mergeSupercarsStatsRowsByCar merges rows with one canonical car number (duplicates from name spelling in events).
func mergeSupercarsStatsRowsByCar(rows []DriverStatsRow) []DriverStatsRow {
	if len(rows) == 0 {
		return rows
	}
	byCar := make(map[string]*DriverStatsRow)
	for i := range rows {
		r := &rows[i]
		car := SupercarsCarToCanonical(strings.TrimSpace(r.Car))
		if existing, ok := byCar[car]; ok {
			prevRaces := existing.Races
			prevQual := existing.QualAppearances
			totalRaces := prevRaces + r.Races
			totalQual := prevQual + r.QualAppearances
			existing.Races = totalRaces
			existing.Wins += r.Wins
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.QualAppearances = totalQual
			existing.AvgFinish = (existing.AvgFinish*float64(prevRaces) + r.AvgFinish*float64(r.Races)) / float64(totalRaces)
			if totalQual > 0 {
				existing.AvgStart = (existing.AvgStart*float64(prevQual) + r.AvgStart*float64(r.QualAppearances)) / float64(totalQual)
			} else if existing.AvgStart == 0 && r.AvgStart > 0 {
				existing.AvgStart = r.AvgStart
			}
			if r.Team != "" && existing.Team == "" {
				existing.Team = r.Team
			}
			if r.Manufacturer != "" && existing.Manufacturer == "" {
				existing.Manufacturer = r.Manufacturer
			}
			if r.Races > 0 && (existing.Driver == "" || r.Races > prevRaces) {
				existing.Driver = r.Driver
			}
			continue
		}
		r2 := *r
		r2.Car = car
		byCar[car] = &r2
	}
	var out []DriverStatsRow
	for _, r := range byCar {
		out = append(out, *r)
	}
	return out
}

// MergeSupercarsDriverStatsRows normalizes 800→8 and merges one driver's rows (for DB data).
// Group by (canonicalDriverKey(driver), car) to collapse duplicates with different name spellings.
func MergeSupercarsDriverStatsRows(rows []DriverStatsRow) []DriverStatsRow {
	if len(rows) == 0 {
		return rows
	}
	type key struct {
		driver string
		car    string
	}
	merged := make(map[key]*DriverStatsRow)
	var order []key
	for i := range rows {
		r := &rows[i]
		car := SupercarsCarToCanonical(strings.TrimSpace(r.Car))
		canonDriver := canonicalDriverKey(strings.TrimSpace(r.Driver))
		k := key{driver: canonDriver, car: car}
		if existing, ok := merged[k]; ok {
			prevRaces := existing.Races
			totalRaces := prevRaces + r.Races
			if totalRaces == 0 {
				continue
			}
			existing.Races = totalRaces
			existing.Wins += r.Wins
			existing.Points += r.Points
			existing.Poles += r.Poles
			existing.Top2 += r.Top2
			existing.Top3 += r.Top3
			existing.Podiums += r.Podiums
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.Top15 += r.Top15
			existing.Top20 += r.Top20
			existing.StageWins += r.StageWins
			existing.StagePoints += r.StagePoints
			existing.FastestLaps += r.FastestLaps
			existing.DNFs += r.DNFs
			existing.SprintWins += r.SprintWins
			existing.SprintPodiums += r.SprintPodiums
			existing.FeatureWins += r.FeatureWins
			existing.FeaturePodiums += r.FeaturePodiums
			existing.LapsLed += r.LapsLed
			// Weighted averages by races
			existing.AvgFinish = (existing.AvgFinish*float64(prevRaces) + r.AvgFinish*float64(r.Races)) / float64(totalRaces)
			existing.AvgStart = (existing.AvgStart*float64(prevRaces) + r.AvgStart*float64(r.Races)) / float64(totalRaces)
			existing.LapsCompletedPct = (existing.LapsCompletedPct*float64(prevRaces) + r.LapsCompletedPct*float64(r.Races)) / float64(totalRaces)
			existing.PositionDiff = (existing.PositionDiff*float64(prevRaces) + r.PositionDiff*float64(r.Races)) / float64(totalRaces)
			if totalRaces > 0 {
				existing.AvgStagePoints = float64(existing.StagePoints) / float64(totalRaces)
			}
			if r.Team != "" {
				existing.Team = r.Team
			}
			if r.Manufacturer != "" {
				existing.Manufacturer = r.Manufacturer
			}
			if r.Class != "" {
				existing.Class = r.Class
			}
			// Keep display name from row with more races
			if r.Races > prevRaces {
				existing.Driver = r.Driver
			}
			continue
		}
		r2 := *r
		r2.Car = car
		merged[k] = &r2
		order = append(order, k)
	}
	var out []DriverStatsRow
	for _, k := range order {
		out = append(out, *merged[k])
	}
	sort.Slice(out, func(i, j int) bool {
		return openWheelDriverStatsRowLess(out[i], out[j])
	})
	return out
}

// mergeStockCarDriverStatsRows merges stock-car stats duplicate rows
// (NASCAR Cup/Truck/Modified, ARCA, NOAPS) when the same driver appears
// with different spelling or car numbers across events.
// Key is canonicalDriverKey(driver) — aggregate by person, not car number.
func mergeStockCarDriverStatsRows(rows []DriverStatsRow) []DriverStatsRow {
	if len(rows) == 0 {
		return rows
	}
	type key struct {
		driver string
	}
	merged := make(map[key]*DriverStatsRow)
	var order []key
	for i := range rows {
		r := &rows[i]
		canonDriver := canonicalDriverKey(strings.TrimSpace(r.Driver))
		k := key{driver: canonDriver}
		if existing, ok := merged[k]; ok {
			prevRaces := existing.Races
			totalRaces := prevRaces + r.Races
			if totalRaces == 0 {
				continue
			}
			existing.Races = totalRaces
			existing.Wins += r.Wins
			existing.Points += r.Points
			existing.Poles += r.Poles
			existing.Top2 += r.Top2
			existing.Top3 += r.Top3
			existing.Podiums += r.Podiums
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.Top15 += r.Top15
			existing.Top20 += r.Top20
			existing.StageWins += r.StageWins
			existing.StagePoints += r.StagePoints
			existing.FastestLaps += r.FastestLaps
			existing.DNFs += r.DNFs
			existing.SprintWins += r.SprintWins
			existing.SprintPodiums += r.SprintPodiums
			existing.FeatureWins += r.FeatureWins
			existing.FeaturePodiums += r.FeaturePodiums
			existing.LapsLed += r.LapsLed
			// Weighted averages by race count.
			existing.AvgFinish = (existing.AvgFinish*float64(prevRaces) + r.AvgFinish*float64(r.Races)) / float64(totalRaces)
			existing.AvgStart = (existing.AvgStart*float64(prevRaces) + r.AvgStart*float64(r.Races)) / float64(totalRaces)
			existing.LapsCompletedPct = (existing.LapsCompletedPct*float64(prevRaces) + r.LapsCompletedPct*float64(r.Races)) / float64(totalRaces)
			existing.PositionDiff = (existing.PositionDiff*float64(prevRaces) + r.PositionDiff*float64(r.Races)) / float64(totalRaces)
			if totalRaces > 0 {
				existing.AvgStagePoints = float64(existing.StagePoints) / float64(totalRaces)
			}
			// Team/Car: if values differ, join with " / ".
			// Avoids losing data when one driver has duplicates from different sources.
			if strings.TrimSpace(r.Team) != "" {
				existing.Team = joinWithSlashUnique(existing.Team, r.Team)
			}
			if r.Manufacturer != "" && (existing.Manufacturer == "" || r.Races > prevRaces) {
				existing.Manufacturer = r.Manufacturer
			}
			if r.Class != "" && (existing.Class == "" || r.Races > prevRaces) {
				existing.Class = r.Class
			}
			if strings.TrimSpace(r.Car) != "" {
				existing.Car = joinWithSlashUnique(existing.Car, strings.TrimSpace(r.Car))
			}
			// For display name take variant with more races (and non-empty string).
			if r.Races > prevRaces && strings.TrimSpace(r.Driver) != "" {
				existing.Driver = r.Driver
			}
			continue
		}
		r2 := *r
		merged[k] = &r2
		order = append(order, k)
	}
	var out []DriverStatsRow
	for _, k := range order {
		out = append(out, *merged[k])
	}
	sort.Slice(out, func(i, j int) bool {
		return stockCarDriverStatsRowLess(out[i], out[j])
	})
	return out
}

func stockCarDriverStatsRowLess(a, b DriverStatsRow) bool {
	if a.Points != b.Points {
		return a.Points > b.Points
	}
	if a.Wins != b.Wins {
		return a.Wins > b.Wins
	}
	if a.Top5 != b.Top5 {
		return a.Top5 > b.Top5
	}
	if a.Top10 != b.Top10 {
		return a.Top10 > b.Top10
	}
	return a.Driver < b.Driver
}

func openWheelDriverStatsRowLess(a, b DriverStatsRow) bool {
	if a.Wins != b.Wins {
		return a.Wins > b.Wins
	}
	if a.Podiums != b.Podiums {
		return a.Podiums > b.Podiums
	}
	if a.Top5 != b.Top5 {
		return a.Top5 > b.Top5
	}
	if a.Top10 != b.Top10 {
		return a.Top10 > b.Top10
	}
	return a.Driver < b.Driver
}

func supercarsDriverStatsRowLess(a, b DriverStatsRow) bool {
	if a.Wins != b.Wins {
		return a.Wins > b.Wins
	}
	if a.Top5 != b.Top5 {
		return a.Top5 > b.Top5
	}
	if a.Top10 != b.Top10 {
		return a.Top10 > b.Top10
	}
	return a.Driver < b.Driver
}

func genericChampionshipDriverStatsRowLess(a, b DriverStatsRow) bool {
	if a.Points != b.Points && (a.Points > 0 || b.Points > 0) {
		return a.Points > b.Points
	}
	if a.Wins != b.Wins {
		return a.Wins > b.Wins
	}
	if a.Podiums != b.Podiums {
		return a.Podiums > b.Podiums
	}
	if a.Top5 != b.Top5 {
		return a.Top5 > b.Top5
	}
	if a.Top10 != b.Top10 {
		return a.Top10 > b.Top10
	}
	return a.Driver < b.Driver
}

func defaultDriverStatsRowLess(seriesID string, a, b DriverStatsRow) bool {
	switch strings.ToUpper(strings.TrimSpace(seriesID)) {
	case "NASCAR_CUP", "NOAPS", "NASCAR_TRUCK", "ARCA", "NASCAR_MODIFIED":
		return stockCarDriverStatsRowLess(a, b)
	case "F1", "F2", "F3":
		return openWheelDriverStatsRowLess(a, b)
	case "SUPERCARS":
		return supercarsDriverStatsRowLess(a, b)
	default:
		return genericChampionshipDriverStatsRowLess(a, b)
	}
}

func isStockCarStatsSeries(seriesID string) bool {
	switch strings.ToUpper(strings.TrimSpace(seriesID)) {
	case "NASCAR_CUP", "NOAPS", "NASCAR_TRUCK", "ARCA", "NASCAR_MODIFIED":
		return true
	default:
		return false
	}
}

// accumulateStageStatsPerRace reads stage wins and points from stage tables.
// Includes stage_3 on 4-stage Cup races. Daytona Duels add to points only (not stage wins).
// When a Points/Pts column is present, values are taken from JSON (respecting 0 for ineligible drivers).
// Without Points, stock-car series fall back to 11−Pos for top 10 among points-eligible drivers only.
func accumulateStageStatsPerRace(seriesID string, detail *EventDetailJSON, eligibleByCar map[string]bool, useEligibleRules bool) (wins, points map[string]int) {
	wins = make(map[string]int)
	points = make(map[string]int)
	if detail == nil || detail.Tables == nil {
		return wins, points
	}
	tables := detail.Tables
	maxStage := 2
	if eventHasFourStages(detail) {
		maxStage = 3
	}
	addFromStageTable := func(st EventTable, countWins bool) {
		spos := firstColIndex(st.Headers, "Pos", "Fin")
		sDriver := firstColIndex(st.Headers, "Driver")
		sNo := firstColIndex(st.Headers, "No", "No.", "#", "Car")
		sPts := firstColIndex(st.Headers, "Points")
		if sPts < 0 {
			sPts = firstColIndex(st.Headers, "Pts")
		}
		if sDriver < 0 {
			return
		}
		for _, row := range st.Rows {
			dr := valueAt(row, sDriver)
			no := valueAt(row, sNo)
			key := canonicalDriverKey(dr) + "\t" + no
			stagePos := atoiSafe(valueAt(row, spos))
			if stagePos <= 0 {
				continue
			}
			if countWins && stagePos == 1 {
				wins[key]++
			}
			pts := 0
			if sPts >= 0 {
				pts = parseStagePointsCell(valueAt(row, sPts))
			} else if stagePos <= 10 && (!useEligibleRules || isDriverPointsEligible(dr, no, eligibleByCar)) {
				pts = 11 - stagePos
			}
			points[key] += pts
		}
	}
	for sn := 1; sn <= maxStage; sn++ {
		st, ok := StageN(tables, sn)
		if !ok {
			continue
		}
		addFromStageTable(st, true)
	}
	if strings.EqualFold(seriesID, "NASCAR_CUP") {
		for _, key := range []string{"duel1", "duel2", "duel_1", "duel_2"} {
			if st, ok := tables[key]; ok && len(st.Headers) > 0 {
				addFromStageTable(st, false)
			}
		}
	}
	return wins, points
}

func parseStagePointsCell(raw string) int {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0
	}
	pts := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			pts = pts*10 + int(c-'0')
		}
	}
	return pts
}

func isDriverPointsEligible(driver, car string, eligibleByCar map[string]bool) bool {
	if strings.Contains(strings.ToLower(strings.TrimSpace(driver)), "(i)") {
		return false
	}
	car = strings.TrimSpace(car)
	if car != "" && eligibleByCar != nil {
		if eligible, exists := eligibleByCar[car]; exists && !eligible {
			return false
		}
	}
	return true
}

func joinWithSlashUnique(base, next string) string {
	b := strings.TrimSpace(base)
	n := strings.TrimSpace(next)
	if b == "" {
		return n
	}
	if n == "" {
		return b
	}
	parts := strings.Split(b, "/")
	for _, p := range parts {
		if strings.EqualFold(strings.TrimSpace(p), n) {
			return b
		}
	}
	return b + " / " + n
}
