package schedulefile

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
)

// EnrichPSCEvent recalculates race_results points using PSC guest scoring rules.
func EnrichPSCEvent(body []byte, seriesID string) ([]byte, error) {
	if strings.ToLower(seriesID) != "psc" {
		return body, nil
	}
	var detail EventDetailJSON
	if err := json.Unmarshal(body, &detail); err != nil {
		return body, err
	}
	if rr, ok := detail.Tables["race_results"]; ok {
		ApplyPSCRacePoints(detail.EntryList, &rr)
		if detail.Tables == nil {
			detail.Tables = make(map[string]EventTable)
		}
		detail.Tables["race_results"] = rr
	}
	return json.Marshal(detail)
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
	"nascar_truck":   true,
	"nascar_cup":     true,
	"noaps":          true,
	"arca":           true,
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

