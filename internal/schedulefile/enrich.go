package schedulefile

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
)

// EnrichPSCEvent recalculates race_results / race.sessions points using PSC guest scoring.
// Mutates the original JSON map so start_date, session meta, and other extra fields stay intact.
func EnrichPSCEvent(body []byte, seriesID string) ([]byte, error) {
	if strings.ToLower(seriesID) != "psc" {
		return body, nil
	}
	var detail EventDetailJSON
	if err := json.Unmarshal(body, &detail); err != nil {
		return body, err
	}
	var root map[string]interface{}
	if err := json.Unmarshal(body, &root); err != nil {
		return body, err
	}
	tables, _ := root["tables"].(map[string]interface{})
	if tables == nil {
		return body, nil
	}
	apply := func(m map[string]interface{}) {
		if m == nil {
			return
		}
		tbl := eventTableFromJSONMap(m)
		if len(tbl.Rows) == 0 {
			// Session not published yet: leave the table exactly as stored so an absent
			// "rows" key does not turn into JSON null for the client.
			return
		}
		ApplyPSCRacePoints(detail.EntryList, &tbl)
		if len(tbl.Headers) > 0 {
			m["headers"] = tbl.Headers
		}
		m["rows"] = tbl.Rows
	}
	if rr, ok := tables["race_results"].(map[string]interface{}); ok {
		apply(rr)
	}
	if race, ok := tables["race"].(map[string]interface{}); ok {
		if sessions, ok := race["sessions"].([]interface{}); ok {
			for _, s := range sessions {
				if sm, ok := s.(map[string]interface{}); ok {
					apply(sm)
				}
			}
		}
	}
	return json.Marshal(root)
}

func eventTableFromJSONMap(m map[string]interface{}) EventTable {
	t := EventTable{
		Headers: jsonStringSlice(m["headers"]),
		Meta:    jsonStringMap(m["meta"]),
	}
	rows, _ := m["rows"].([]interface{})
	if len(rows) == 0 {
		return t
	}
	t.Rows = make([][]string, 0, len(rows))
	for _, row := range rows {
		t.Rows = append(t.Rows, jsonStringSlice(row))
	}
	return t
}

func jsonStringMap(v interface{}) map[string]string {
	obj, ok := v.(map[string]interface{})
	if !ok || len(obj) == 0 {
		return nil
	}
	out := make(map[string]string, len(obj))
	for k, raw := range obj {
		out[k] = strings.TrimSpace(fmt.Sprint(raw))
	}
	return out
}

func jsonStringSlice(v interface{}) []string {
	arr, ok := v.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, len(arr))
	for i, x := range arr {
		if x == nil {
			continue
		}
		if s, ok := x.(string); ok {
			out[i] = s
			continue
		}
		out[i] = fmt.Sprint(x)
	}
	return out
}

// EnrichSupercarsEvent enriches Supercars event JSON: entry_list from Teams and team_names_by_number.
// Returns updated body or the original on error / non-Supercars.
func EnrichSupercarsEvent(body []byte, dataDir, seriesID string) ([]byte, error) {
	if strings.ToLower(seriesID) != "supercars" {
		return body, nil
	}
	teams, err := LoadTeams(dataDir, seriesID)
	if err != nil || teams == nil || len(teams.Teams) == 0 {
		return body, nil
	}
	var eventMap map[string]interface{}
	if err := json.Unmarshal(body, &eventMap); err != nil {
		return body, err
	}
	if entryListRaw := eventMap["entry_list"]; entryListRaw == nil {
		entryList := make([]map[string]interface{}, 0, len(teams.Teams))
		for _, t := range teams.Teams {
			entryList = append(entryList, map[string]interface{}{
				"number":       t.Number,
				"driver":       t.Driver,
				"team":         t.Team,
				"manufacturer": t.Manufacturer,
			})
		}
		eventMap["entry_list"] = entryList
	}
	byNumber := make(map[string]string)
	if entryListRaw, ok := eventMap["entry_list"]; ok && entryListRaw != nil {
		if list, ok := entryListRaw.([]interface{}); ok {
			for _, item := range list {
				m, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				numVal := m["number"]
				teamVal, _ := m["team"].(string)
				if teamVal == "" {
					continue
				}
				var numStr string
				switch v := numVal.(type) {
				case string:
					numStr = strings.TrimSpace(v)
				case float64:
					numStr = strconv.Itoa(int(v))
				default:
					continue
				}
				if numStr == "" {
					continue
				}
				byNumber[numStr] = teamVal
				if n, err := strconv.Atoi(strings.TrimLeft(numStr, "0")); err == nil {
					byNumber[strconv.Itoa(n)] = teamVal
					if n >= 1 && n <= 9 {
						byNumber[fmt.Sprintf("%02d", n)] = teamVal
					}
				}
			}
		}
	}
	if len(byNumber) > 0 {
		eventMap["team_names_by_number"] = byNumber
	}
	return json.Marshal(eventMap)
}

var stockCarSeriesIDs = map[string]bool{
	"nascar_truck":    true,
	"nascar_cup":      true,
	"noaps":           true,
	"arca":            true,
	"nascar_modified": true,
}

// EnrichStockCarEventTeamNames sets team_names_by_number from the series Teams file (for entry list and tables).
// UI team names come from Teams, not from the event entry_list.
func EnrichStockCarEventTeamNames(body []byte, dataDir, seriesID string) ([]byte, error) {
	if seriesID == "" {
		return body, nil
	}
	s := strings.ToLower(seriesID)
	if !stockCarSeriesIDs[s] {
		return body, nil
	}
	dataSeriesID := config.DataSeriesID(seriesID)
	teams, err := LoadTeams(dataDir, dataSeriesID)
	if err != nil || teams == nil || len(teams.Teams) == 0 {
		return body, nil
	}
	byNumber := make(map[string]string)
	for _, t := range teams.Teams {
		numStr := strings.TrimSpace(t.Number)
		if numStr == "" {
			continue
		}
		teamVal := strings.TrimSpace(t.Team)
		if teamVal == "" {
			continue
		}
		byNumber[numStr] = teamVal
		if n, err := strconv.Atoi(strings.TrimLeft(numStr, "0")); err == nil {
			byNumber[strconv.Itoa(n)] = teamVal
			if n >= 1 && n <= 9 {
				byNumber[fmt.Sprintf("%02d", n)] = teamVal
			}
		}
	}
	if len(byNumber) == 0 {
		return body, nil
	}
	var eventMap map[string]interface{}
	if err := json.Unmarshal(body, &eventMap); err != nil {
		return body, err
	}
	eventMap["team_names_by_number"] = byNumber
	return json.Marshal(eventMap)
}

// isExhibitionEvent reports whether an event is an exhibition race whose results
// must not count toward championship standings.
// Cup Series: Cook Out Clash (..._0) and NASCAR All-Star Race
// (..._ALLSTAR_RACE / any suffix containing "ALLSTAR"). These events have race_results
// but award no championship points, so they must not shift race_order.
func isExhibitionEvent(seriesID string, eventID string) bool {
	if !strings.EqualFold(seriesID, "NASCAR_CUP") {
		return false
	}
	parts := strings.Split(eventID, "_")
	if len(parts) == 0 {
		return false
	}
	last := parts[len(parts)-1]
	if last == "0" {
		return true
	}
	upper := strings.ToUpper(eventID)
	if strings.Contains(upper, "ALLSTAR") || strings.Contains(upper, "ALL_STAR") {
		return true
	}
	return false
}

// skipChampionshipMetricsEvent excludes exhibition / pre-season / prologue rounds
// from standings, stats, and head-to-head (calendar pages may still list them).
func skipChampionshipMetricsEvent(seriesID, eventID string) bool {
	if isExhibitionEvent(seriesID, eventID) {
		return true
	}
	u := strings.ToUpper(strings.TrimSpace(eventID))
	if u == "" {
		return false
	}
	if isF1PreSeasonEvent(eventID) {
		return true
	}
	if strings.Contains(u, "PROLOGUE") {
		return true
	}
	return false
}

// isFutureScheduleEvent is true when the event's start date is after today (YYYY-MM-DD).
func isFutureScheduleEvent(ev EventJSON, today string) bool {
	if today == "" || ev.StartDate == "" {
		return false
	}
	return ev.StartDate > today
}
