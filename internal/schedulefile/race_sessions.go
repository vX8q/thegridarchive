package schedulefile

import (
	"encoding/json"
	"fmt"
	"strings"
)

// RaceSession is one race session from event JSON (tables.race.sessions or tables.race with headers/rows).
// The same format is used for F1, F2, F3, Supercars, etc.
type RaceSession struct {
	Title   string     // "Sprint Race Results", "Race 4", ...
	Headers []string
	Rows    [][]string
}

// LoadEventEntryList returns car number -> full driver name from the event entry_list.
// Used for F2/F3: result tables may have "M. Shin" / "W. Shin" for one driver — substitute canonical name by car number.
func LoadEventEntryList(dataDir, eventID string) (map[string]string, error) {
	raw, err := readEventDetailFile(dataDir, eventID)
	if err != nil {
		return nil, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	entryAny, ok := root["entry_list"]
	if !ok {
		return nil, nil
	}
	entrySlice, ok := entryAny.([]interface{})
	if !ok || len(entrySlice) == 0 {
		return nil, nil
	}
	out := make(map[string]string)
	for _, item := range entrySlice {
		obj, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		num := strings.TrimSpace(fmt.Sprint(obj["number"]))
		driver := strings.TrimSpace(fmt.Sprint(obj["driver"]))
		if num != "" && driver != "" {
			out[num] = driver
		}
	}
	return out, nil
}

// LoadEventPointsEligibleByCar returns car number -> points eligible from entry_list.
// Missing entry or nil points_eligible defaults to true.
func LoadEventPointsEligibleByCar(dataDir, eventID string) (map[string]bool, error) {
	detail, err := LoadEventDetail(dataDir, eventID)
	if err != nil || detail == nil {
		return nil, err
	}
	out := make(map[string]bool)
	for _, e := range detail.EntryList {
		num := strings.TrimSpace(e.Number)
		if num == "" {
			continue
		}
		eligible := true
		if e.PointsEligible != nil {
			eligible = *e.PointsEligible
		}
		out[num] = eligible
	}
	if len(out) == 0 {
		return nil, nil
	}
	return out, nil
}

// stockCarIneligibleDriver marks driver as ineligible when entry_list says so or name has (i).
func stockCarIneligibleDriver(driver, car string, eligibleByCar map[string]bool) string {
	driver = strings.TrimSpace(driver)
	if driver == "" {
		return driver
	}
	if strings.Contains(strings.ToLower(driver), "(i)") {
		return ensureIneligibleSuffix(driver)
	}
	if car != "" && eligibleByCar != nil {
		if ok, exists := eligibleByCar[car]; exists && !ok {
			return ensureIneligibleSuffix(driver)
		}
	}
	return driver
}

func ensureIneligibleSuffix(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return name
	}
	if strings.Contains(strings.ToLower(name), "(i)") {
		return name
	}
	return name + " (i)"
}

// loadEventRaceSessionsFromRaceTable reads only tables.race.sessions (no fallback to race_results).
// Needed to detect F1 sprint weekends: race_results alone does not mean a sprint.
func loadEventRaceSessionsFromRaceTable(dataDir, eventID string) ([]RaceSession, error) {
	raw, err := readEventDetailFile(dataDir, eventID)
	if err != nil {
		return nil, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	tables, ok := root["tables"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	raceAny, ok := tables["race"]
	if !ok {
		return nil, nil
	}
	raceMap, ok := raceAny.(map[string]interface{})
	if !ok {
		return nil, nil
	}
	sessionsAny, hasSessions := raceMap["sessions"].([]interface{})
	if !hasSessions {
		return nil, nil
	}
	var out []RaceSession
	for _, sessAny := range sessionsAny {
		sessMap, ok := sessAny.(map[string]interface{})
		if !ok {
			continue
		}
		title := strings.TrimSpace(fmt.Sprint(sessMap["title"]))
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
		var rows [][]string
		for _, rAny := range rowsAny {
			rSlice, ok := rAny.([]interface{})
			if !ok {
				continue
			}
			row := make([]string, len(rSlice))
			for i := range rSlice {
				row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
			}
			rows = append(rows, row)
		}
		out = append(out, RaceSession{Title: title, Headers: headers, Rows: rows})
	}
	return out, nil
}

// LoadEventRaceSessions reads event JSON and returns sessions from tables.race.sessions (or one tables.race table).
// Used for DB import and standings build; one format for F1/F2/F3/Supercars.
func LoadEventRaceSessions(dataDir, eventID string) ([]RaceSession, error) {
	raw, err := readEventDetailFile(dataDir, eventID)
	if err != nil {
		return nil, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	tables, ok := root["tables"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	// F1 etc.: results table in tables.race or tables.race_results
	raceAny, ok := tables["race"]
	if !ok {
		raceAny, ok = tables["race_results"]
		if !ok {
			return nil, nil
		}
	}
	raceMap, ok := raceAny.(map[string]interface{})
	if !ok {
		return nil, nil
	}
	// Variant 1: tables.race.sessions[] (F2, F3, Supercars)
	sessionsAny, hasSessions := raceMap["sessions"].([]interface{})
	if !hasSessions {
		// Variant 2: single tables.race table with headers/rows (F1, etc.)
		if h, ok1 := raceMap["headers"].([]interface{}); ok1 {
			if r, ok2 := raceMap["rows"].([]interface{}); ok2 {
				var headers []string
				for _, v := range h {
					headers = append(headers, strings.TrimSpace(fmt.Sprint(v)))
				}
				var rows [][]string
				for _, rAny := range r {
					rSlice, ok := rAny.([]interface{})
					if !ok {
						continue
					}
					row := make([]string, len(rSlice))
					for i := range rSlice {
						row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
					}
					rows = append(rows, row)
				}
				if len(headers) > 0 && len(rows) > 0 {
					title := strings.TrimSpace(fmt.Sprint(raceMap["title"]))
					if title == "" {
						title = "Race"
					}
					return []RaceSession{{Title: title, Headers: headers, Rows: rows}}, nil
				}
			}
		}
		return nil, nil
	}
	var out []RaceSession
	for _, sessAny := range sessionsAny {
		sessMap, ok := sessAny.(map[string]interface{})
		if !ok {
			continue
		}
		title := strings.TrimSpace(fmt.Sprint(sessMap["title"]))
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
		var rows [][]string
		for _, rAny := range rowsAny {
			rSlice, ok := rAny.([]interface{})
			if !ok {
				continue
			}
			row := make([]string, len(rSlice))
			for i := range rSlice {
				row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
			}
			rows = append(rows, row)
		}
		out = append(out, RaceSession{Title: title, Headers: headers, Rows: rows})
	}
	return out, nil
}

// LoadEventQualifyingSessions reads tables.qualifying.sessions from event JSON.
func LoadEventQualifyingSessions(dataDir, eventID string) ([]RaceSession, error) {
	raw, err := readEventDetailFile(dataDir, eventID)
	if err != nil {
		return nil, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	tables, ok := root["tables"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	qualAny, ok := tables["qualifying"]
	if !ok {
		return nil, nil
	}
	qualMap, ok := qualAny.(map[string]interface{})
	if !ok {
		return nil, nil
	}
	sessionsAny, ok := qualMap["sessions"].([]interface{})
	if !ok || len(sessionsAny) == 0 {
		return nil, nil
	}
	var out []RaceSession
	for _, sessAny := range sessionsAny {
		sessMap, ok := sessAny.(map[string]interface{})
		if !ok {
			continue
		}
		title := strings.TrimSpace(fmt.Sprint(sessMap["title"]))
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
		var rows [][]string
		for _, rAny := range rowsAny {
			rSlice, ok := rAny.([]interface{})
			if !ok {
				continue
			}
			row := make([]string, len(rSlice))
			for i := range rSlice {
				row[i] = strings.TrimSpace(fmt.Sprint(rSlice[i]))
			}
			rows = append(rows, row)
		}
		if len(headers) > 0 && len(rows) > 0 {
			out = append(out, RaceSession{Title: title, Headers: headers, Rows: rows})
		}
	}
	return out, nil
}

// LoadSupercarsStartingGridByRace reads tables.starting_lineup.sessions from event JSON.
// Returns per race (race_no 1..7) a map: canonical car number -> starting position (Pos).
// Used to fill results.grid_position on import and for Avg. Start in stats.
func LoadSupercarsStartingGridByRace(dataDir, eventID string) (map[int]map[string]int, error) {
	raw, err := readEventDetailFile(dataDir, eventID)
	if err != nil {
		return nil, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, err
	}
	tables, ok := root["tables"].(map[string]interface{})
	if !ok {
		return nil, nil
	}
	slAny, ok := tables["starting_lineup"]
	if !ok {
		return nil, nil
	}
	slMap, ok := slAny.(map[string]interface{})
	if !ok {
		return nil, nil
	}
	sessList, ok := slMap["sessions"].([]interface{})
	if !ok || len(sessList) == 0 {
		return nil, nil
	}
	out := make(map[int]map[string]int)
	for idx, sessAny := range sessList {
		sessMap, ok := sessAny.(map[string]interface{})
		if !ok {
			continue
		}
		raceNo := idx + 1
		if meta, ok := sessMap["meta"].(map[string]interface{}); ok {
			if rn, ok := meta["race_no"]; ok {
				switch v := rn.(type) {
				case float64:
					raceNo = int(v)
				case int:
					raceNo = v
				}
			}
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
		if colPos < 0 || colNo < 0 {
			continue
		}
		byCar := make(map[string]int)
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
			car := SupercarsCarToCanonical(valueAt(row, colNo))
			if car == "" {
				continue
			}
			byCar[car] = pos
		}
		if len(byCar) > 0 {
			out[raceNo] = byCar
		}
	}
	return out, nil
}
