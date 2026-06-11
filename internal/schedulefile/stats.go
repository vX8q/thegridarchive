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
		driver       string
		team         string
		manufacturer string
		car          string
		races        int
		wins         int
		top2         int
		top3         int
		poles        int
		top5         int
		top10        int
		top15        int
		top20        int
		sumFinish    float64
		sumStart     float64
		sumLaps      int
		totalLaps    int
		sumPosDiff   float64
		posDiffCnt   int
		stageWins    int
		stagePoints  int
		lapsLed      int
	}
	byDriver := make(map[string]*driverAcc)

	for _, e := range events {
		if e.Season != season {
			continue
		}
		if isExhibitionEvent(seriesID, e.ID) {
			continue
		}
		if strings.EqualFold(seriesID, "NASCAR_CUP") && e.StartDate > today {
			continue
		}
		detail, err := LoadEventDetail(dataDir, e.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		rr, ok := detail.Tables["race_results"]
		if !ok || len(rr.Headers) == 0 || len(rr.Rows) == 0 {
			continue
		}
		colPos := firstColIndex(rr.Headers, "Pos", "Fin")
		colGrid := firstColIndex(rr.Headers, "Grid", "St", "Start", "Started", "Start Pos")
		colNo := firstColIndex(rr.Headers, "No", "No.", "#", "Car")
		colDriver := firstColIndex(rr.Headers, "Driver")
		// Open-wheel series (F1/F2/F3) in event JSON often use "Constructor" instead of "Team".
		// Use both to ensure we populate team/clickable constructor correctly.
		colTeam := firstColIndex(rr.Headers, "Team", "Constructor")
		colManu := firstColIndex(rr.Headers, "Manufacturer", "Chassis", "Make")
		colLaps := firstColIndex(rr.Headers, "Laps")
		colLed := firstColIndex(rr.Headers, "Led", "Laps Led")
		if colDriver < 0 {
			continue
		}
		eventsWithResults++
		raceLaps := 0
		for _, row := range rr.Rows {
			if l := atoiSafe(valueAt(row, colLaps)); l > raceLaps {
				raceLaps = l
			}
		}
		if raceLaps == 0 && detail.Laps != "" {
			raceLaps = atoiSafe(detail.Laps)
		}
		stageWinsThisRace := make(map[string]int)
		stagePointsThisRace := make(map[string]int)
		for sn := 1; sn <= 2; sn++ {
			st, ok := StageN(detail.Tables, sn)
			if !ok {
				continue
			}
			spos := firstColIndex(st.Headers, "Pos", "Fin")
			sDriver := firstColIndex(st.Headers, "Driver")
			sNo := firstColIndex(st.Headers, "No", "#", "Car")
			if sDriver < 0 {
				continue
			}
			for _, row := range st.Rows {
				stagePos := atoiSafe(valueAt(row, spos))
				if stagePos <= 0 {
					continue
				}
				dr := valueAt(row, sDriver)
				no := valueAt(row, sNo)
				// Use canonicalDriverKey so we can match with race_results aggregation keys.
				key := canonicalDriverKey(dr) + "\t" + no
				if stagePos == 1 {
					stageWinsThisRace[key]++
				}
				if stagePos <= 10 {
					// NASCAR stage scoring: P1..P10 = 10..1 points.
					stagePointsThisRace[key] += 11 - stagePos
				}
			}
		}
		for rowIdx, row := range rr.Rows {
			driverName := valueAt(row, colDriver)
			// F1: normalize Carlos Sainz -> Carlos Sainz Jr.
			if strings.EqualFold(seriesID, "F1") && strings.TrimSpace(driverName) == "Carlos Sainz" {
				driverName = "Carlos Sainz Jr."
			}
			driverName = preferredDriverName(driverName)
			if driverName == "" {
				continue
			}
			carNumber := valueAt(row, colNo)
			teamName := valueAt(row, colTeam)
			manufacturer := valueAt(row, colManu)
			if manufacturer == "" && indyEngineByCar != nil && carNumber != "" {
				if eng, ok := indyEngineByCar[carNumber]; ok {
					manufacturer = eng
				}
			}
			posStr := strings.TrimSpace(valueAt(row, colPos))
			pos := atoiSafe(posStr)
			if pos <= 0 && posStr != "" && !isAllDigits(posStr) {
				// For non-numeric positions (DNF, NC, Ret, etc.) use row index as position.
				pos = rowIdx + 1
			}
			grid := atoiSafe(valueAt(row, colGrid))
			laps := atoiSafe(valueAt(row, colLaps))
			led := 0
			if colLed >= 0 {
				led = atoiSafe(valueAt(row, colLed))
			}
			driverKey := canonicalDriverKey(driverName) + "\t" + carNumber
			if byDriver[driverKey] == nil {
				byDriver[driverKey] = &driverAcc{
					driver: driverName, team: teamName, manufacturer: manufacturer, car: carNumber,
				}
			}
			acc := byDriver[driverKey]
			if acc.team == "" {
				acc.team = teamName
			}
			if acc.manufacturer == "" {
				acc.manufacturer = manufacturer
			}
			// Count a start only if the driver actually ran (at least one lap).
			didStart := laps > 0
			if didStart {
				acc.races++
			}
			if grid == 1 {
				acc.poles++
			}
			if pos == 1 {
				acc.wins++
			}
			if pos == 2 {
				acc.top2++
			}
			if pos == 3 {
				acc.top3++
			}
			if pos >= 1 && pos <= 5 {
				acc.top5++
			}
			if pos >= 1 && pos <= 10 {
				acc.top10++
			}
			if pos >= 1 && pos <= 15 {
				acc.top15++
			}
			if pos >= 1 && pos <= 20 {
				acc.top20++
			}
			// Average finish includes only those who started.
			if didStart && pos > 0 {
				acc.sumFinish += float64(pos)
			}
			if grid > 0 {
				acc.sumStart += float64(grid)
			}
			acc.sumLaps += laps
			acc.totalLaps += raceLaps
			if grid > 0 && pos > 0 {
				acc.sumPosDiff += float64(grid - pos)
				acc.posDiffCnt++
			}
			acc.stageWins += stageWinsThisRace[driverKey]
			acc.stagePoints += stagePointsThisRace[driverKey]
			acc.lapsLed += led
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
		if a.races > 0 && a.sumFinish > 0 {
			avgFinish = a.sumFinish / float64(a.races)
		}
		avgStart := 0.0
		if a.races > 0 && a.sumStart > 0 {
			avgStart = a.sumStart / float64(a.races)
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
			Car:              a.car,
			Races:            a.races,
			Wins:             a.wins,
			Top2:             a.top2,
			Top3:             a.top3,
			Podiums:          a.wins + a.top2 + a.top3,
			Poles:            a.poles,
			Top5:             a.top5,
			Top10:            a.top10,
			Top15:            a.top15,
			Top20:            a.top20,
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
	sort.Slice(out, func(i, j int) bool {
		if out[i].Wins != out[j].Wins {
			return out[i].Wins > out[j].Wins
		}
		if out[i].Top5 != out[j].Top5 {
			return out[i].Top5 > out[j].Top5
		}
		if out[i].Top10 != out[j].Top10 {
			return out[i].Top10 > out[j].Top10
		}
		return out[i].Driver < out[j].Driver
	})

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
	}

	mans := aggregateByManufacturer(out)
	teams := aggregateByTeam(teamSourceRows)

	return &DriverStatsData{Rows: out, Teams: teams, Manufacturers: mans}, nil
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
		driver       string
		team         string
		engine       string
		car          string
		races        int
		wins         int
		top5         int
		top10        int
		sumFinish    float64
		// Supercars race.sessions lack explicit start position, so
		// sumStart/posDiffCount as total qualifying position
		// and qualifying appearances — for Avg. Qualifying.
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
			if !ok {
				goto QUALIFYING_ONLY
			}
			sessionsAny, ok := raceMap["sessions"].([]interface{})
			if !ok {
				goto QUALIFYING_ONLY
			}
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
				for rowIdx, rAny := range rowsAny {
					rSlice, ok := rAny.([]interface{})
					if !ok {
						continue
					}
					row := make([]string, len(rSlice))
					for i := range rSlice {
						row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
					}
					posStr := valueAt(row, colPos)
					pos := atoiSafe(posStr)
					if pos <= 0 {
						// Supercars: rows with Pos="NC" count as last in the race.
						if strings.EqualFold(strings.TrimSpace(posStr), "NC") {
							pos = rowIdx + 1
						} else {
							continue
						}
					}
					driver := valueAt(row, colDriver)
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
					key := canonicalDriverKey(driver) + "\t" + car
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
				}
			}
		}

		// Supercars Avg. Start from starting_lineup tables (grid), not qualifying.
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
							driver := valueAt(row, colDriver)
							if driver == "" {
								continue
							}
							car := SupercarsCarToCanonical(valueAt(row, colNo))
							key := canonicalDriverKey(driver) + "\t" + car
							a := byKey[key]
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

	QUALIFYING_ONLY:
		// Supercars avg_start already from starting_lineup; skip qualifying.
		if _, usedSL := tables["starting_lineup"]; !usedSL {
		if qualAny, ok := tables["qualifying"]; ok {
			qualMap, ok := qualAny.(map[string]interface{})
			if ok {
				// Either sessions array or a single table.
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
							colPos := firstColIndex(headers, "Pos")
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
								// Skip separator rows like "Shoot Out Race 2".
								pos := atoiSafe(valueAt(row, colPos))
								if pos <= 0 {
									continue
								}
								driver := valueAt(row, colDriver)
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
									// For qualifying also substitute team by number from Teams.
									if tName, ok := teamByCar[car]; ok && tName != "" {
										team = tName
									}
								}
								key := driver + "\t" + car
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
								a.sumStart += float64(pos)
								a.posDiffCount++
							}
						}
					}
				} else {
					// Variant: qualifying as one top-level headers/rows table.
					headersAny, ok := qualMap["headers"].([]interface{})
					if ok {
						var headers []string
						for _, h := range headersAny {
							headers = append(headers, strings.TrimSpace(fmt.Sprint(h)))
						}
						rowsAny, ok := qualMap["rows"].([]interface{})
						if ok {
							colPos := firstColIndex(headers, "Pos")
							colNo := firstColIndex(headers, "No", "No.", "#", "Car")
							colDriver := firstColIndex(headers, "Driver")
							colTeam := firstColIndex(headers, "Team")
							if colDriver >= 0 && colPos >= 0 {
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
									driver := valueAt(row, colDriver)
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
									}
									key := driver + "\t" + car
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
									a.sumStart += float64(pos)
									a.posDiffCount++
								}
							}
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
		if a.sumFinish > 0 {
			avgFinish = a.sumFinish / float64(a.races)
		}
		avgStart := 0.0
		if a.sumStart > 0 && a.posDiffCount > 0 {
			avgStart = a.sumStart / float64(a.posDiffCount)
		}
		rows = append(rows, DriverStatsRow{
			Driver:       a.driver,
			Team:         a.team,
			Manufacturer: a.engine,
			Car:          a.car,
			Races:        a.races,
			Wins:         a.wins,
			Top5:         a.top5,
			Top10:        a.top10,
			AvgStart:     roundTo(avgStart, 2),
			AvgFinish:    roundTo(avgFinish, 2),
		})
	}
	// Merge duplicates: one driver may be spelled differently across events (Matthew Payne / Matt Payne).
	// Group by canonical car number and merge stats.
	rows = mergeSupercarsStatsRowsByCar(rows)
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Wins != rows[j].Wins {
			return rows[i].Wins > rows[j].Wins
		}
		if rows[i].Top5 != rows[j].Top5 {
			return rows[i].Top5 > rows[j].Top5
		}
		if rows[i].Top10 != rows[j].Top10 {
			return rows[i].Top10 > rows[j].Top10
		}
		return rows[i].Driver < rows[j].Driver
	})

	mans := aggregateByManufacturer(rows)
	teams := aggregateByTeam(rows)

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
			totalRaces := prevRaces + r.Races
			existing.Races = totalRaces
			existing.Wins += r.Wins
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.AvgFinish = (existing.AvgFinish*float64(prevRaces) + r.AvgFinish*float64(r.Races)) / float64(totalRaces)
			existing.AvgStart = (existing.AvgStart*float64(prevRaces) + r.AvgStart*float64(r.Races)) / float64(totalRaces)
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
			existing.Poles += r.Poles
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.Top15 += r.Top15
			existing.Top20 += r.Top20
			existing.StageWins += r.StageWins
			existing.StagePoints += r.StagePoints
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
		if out[i].Wins != out[j].Wins {
			return out[i].Wins > out[j].Wins
		}
		if out[i].Top5 != out[j].Top5 {
			return out[i].Top5 > out[j].Top5
		}
		if out[i].Top10 != out[j].Top10 {
			return out[i].Top10 > out[j].Top10
		}
		return out[i].Driver < out[j].Driver
	})
	return out
}

// mergeStockCarDriverStatsRows merges stock-car stats duplicate rows
// (NASCAR Cup/Truck/Modified, ARCA, NOAPS) when driver_stats_stockcar view
// has the same driver with different driver_id (e.g. import edits or name spelling).
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
			existing.Poles += r.Poles
			existing.Top5 += r.Top5
			existing.Top10 += r.Top10
			existing.Top15 += r.Top15
			existing.Top20 += r.Top20
			existing.StageWins += r.StageWins
			existing.StagePoints += r.StagePoints
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
	return out
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

