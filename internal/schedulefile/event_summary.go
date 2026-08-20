package schedulefile

import (
	"encoding/json"
	"regexp"
	"strings"
)

// LastResultsWinner is one line on a Last Results home card.
type LastResultsWinner struct {
	Name  string `json:"name"`
	Car   string `json:"car,omitempty"`
	Label string `json:"label,omitempty"`
}

// LastResultsSummary is a slim payload for home Last Results cards.
type LastResultsSummary struct {
	ID                string              `json:"id"`
	Winners           []LastResultsWinner `json:"winners"`
	RangeStart        string              `json:"range_start,omitempty"`
	RangeEnd          string              `json:"range_end,omitempty"`
	RaceWasCancelled  bool                `json:"race_was_cancelled,omitempty"`
	IsF1SprintWeekend bool                `json:"is_f1_sprint_weekend,omitempty"`
	NotFound          bool                `json:"not_found,omitempty"`
}

var (
	reRaceRound   = regexp.MustCompile(`(?i)^Race\s+(Round\s+\d+)$`)
	reRaceN       = regexp.MustCompile(`(?i)(Race\s+\d+)\b`)
	reISODate     = regexp.MustCompile(`\b(\d{4}-\d{2}-\d{2})\b`)
	reTrimResults = regexp.MustCompile(`(?i)\s*Results?$`)
	reTrimRace    = regexp.MustCompile(`(?i)\s*Race$`)
)

// BuildLastResultsSummaryFromBytes extracts card winners from enriched event JSON bytes.
func BuildLastResultsSummaryFromBytes(body []byte, eventID, seriesID string) LastResultsSummary {
	out := LastResultsSummary{
		ID:      strings.ToUpper(strings.TrimSpace(eventID)),
		Winners: []LastResultsWinner{},
	}
	if len(body) == 0 {
		out.NotFound = true
		return out
	}
	var root map[string]interface{}
	if err := json.Unmarshal(body, &root); err != nil || root == nil {
		return out
	}
	sid := strings.ToUpper(strings.TrimSpace(seriesID))
	if sid == "" {
		sid = strings.ToUpper(summaryAsString(root["series"]))
	}
	tables, _ := root["tables"].(map[string]interface{})
	if tables == nil {
		tables = map[string]interface{}{}
	}
	entryList, _ := root["entry_list"].([]interface{})

	out.RangeStart, out.RangeEnd = summaryRaceDateRange(tables, root)
	out.RaceWasCancelled = summaryRaceCancelled(tables)
	out.IsF1SprintWeekend = sid == "F1" && f1RaceBlockIsSprintSessionsOnly(tables["race"])

	race, _ := tables["race"].(map[string]interface{})
	raceResults, _ := tables["race_results"].(map[string]interface{})

	switch sid {
	case "GTWCE_END":
		if race != nil {
			out.Winners = append(out.Winners, summaryGtwceEndWinners(race, root)...)
		}
	case "GTWCE_SPRINT":
		if race != nil {
			for _, sess := range summarySessions(race) {
				label := summarySessionLabel(sess)
				if w, ok := summaryTeamPosWinner(sess, label); ok {
					out.Winners = append(out.Winners, w)
				}
			}
		}
	case "WEC":
		if raceResults != nil {
			out.Winners = append(out.Winners, summaryWecClassWinners(raceResults)...)
		}
	case "IMSA":
		if race != nil {
			out.Winners = append(out.Winners, summaryImsaClassWinners(race)...)
		}
	case "ELMS":
		if race != nil {
			out.Winners = append(out.Winners, summaryElmsClassWinners(race, entryList)...)
		}
	case "SUPER_GT":
		if race != nil {
			out.Winners = append(out.Winners, summarySuperGtClassWinners(race)...)
		}
	default:
		if race != nil {
			for _, sess := range summarySessions(race) {
				label := summarySessionLabel(sess)
				if w, ok := summaryDriverWinner(sess, label); ok {
					out.Winners = append(out.Winners, w)
				}
			}
		}
		if raceResults != nil {
			if strings.EqualFold(summaryAsString(raceResults["format"]), "allstar_stages") {
				if w, ok := summaryAllstarWinner(raceResults, ""); ok {
					out.Winners = append(out.Winners, w)
				}
			} else if len(out.Winners) == 0 {
				if w, ok := summaryDriverWinner(raceResults, ""); ok {
					out.Winners = append(out.Winners, w)
				}
			} else if sid == "F1" && out.IsF1SprintWeekend {
				if w, ok := summaryDriverWinner(raceResults, ""); ok {
					out.Winners = append(out.Winners, w)
				}
			}
		}
		if len(out.Winners) == 0 && race != nil {
			if w, ok := summaryTgaFlatWinner(race, ""); ok {
				out.Winners = append(out.Winners, w)
			}
		}
	}

	if out.IsF1SprintWeekend && len(out.Winners) >= 1 {
		out.Winners[0].Label = "Sprint"
		if len(out.Winners) >= 2 {
			out.Winners[1].Label = "Feature"
		}
	}
	// Super Formula single-race weekends: omit "Round N" on the card (only useful on double/triple headers).
	if sid == "SUPER_FORMULA" && len(out.Winners) == 1 {
		out.Winners[0].Label = ""
	}
	return out
}

func summaryAsString(v interface{}) string {
	if v == nil {
		return ""
	}
	if t, ok := v.(string); ok {
		return t
	}
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	var s string
	if json.Unmarshal(b, &s) == nil {
		return s
	}
	return strings.Trim(string(b), `"`)
}

func summaryHeaders(table map[string]interface{}) []string {
	raw, _ := table["headers"].([]interface{})
	out := make([]string, 0, len(raw))
	for _, h := range raw {
		out = append(out, summaryAsString(h))
	}
	return out
}

func summaryRows(table map[string]interface{}) [][]string {
	raw, _ := table["rows"].([]interface{})
	out := make([][]string, 0, len(raw))
	for _, r := range raw {
		arr, ok := r.([]interface{})
		if !ok {
			continue
		}
		row := make([]string, len(arr))
		for i, c := range arr {
			row[i] = summaryAsString(c)
		}
		out = append(out, row)
	}
	return out
}

func summarySessions(race map[string]interface{}) []map[string]interface{} {
	raw, _ := race["sessions"].([]interface{})
	out := make([]map[string]interface{}, 0, len(raw))
	for _, s := range raw {
		if m, ok := s.(map[string]interface{}); ok {
			out = append(out, m)
		}
	}
	return out
}

func summaryCol(headers []string, names ...string) int {
	lower := make([]string, len(headers))
	for i, h := range headers {
		lower[i] = strings.ToLower(strings.TrimSpace(h))
	}
	for _, want := range names {
		w := strings.ToLower(want)
		for i, h := range lower {
			if h == w {
				return i
			}
		}
	}
	return -1
}

func summaryCell(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func summaryIsP1(pos string) bool {
	p := strings.ToUpper(strings.TrimSpace(pos))
	return p == "1" || p == "P1"
}

func summaryDriverWinner(table map[string]interface{}, label string) (LastResultsWinner, bool) {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	if len(headers) == 0 || len(rows) == 0 {
		return LastResultsWinner{}, false
	}
	posCol := summaryCol(headers, "Pos", "Pos.", "Fin")
	drvCol := summaryCol(headers, "Driver", "Drivers")
	if drvCol < 0 {
		return LastResultsWinner{}, false
	}
	carCol := summaryCol(headers, "Car", "#", "No.", "No", "Car #", "Car No", "Car No.")
	var winner []string
	for _, row := range rows {
		if posCol >= 0 && summaryIsP1(summaryCell(row, posCol)) {
			winner = row
			break
		}
	}
	if winner == nil {
		winner = rows[0]
	}
	name := summaryCell(winner, drvCol)
	if name == "" {
		return LastResultsWinner{}, false
	}
	return LastResultsWinner{Name: name, Car: summaryCell(winner, carCol), Label: label}, true
}

func summaryTeamPosWinner(table map[string]interface{}, label string) (LastResultsWinner, bool) {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	if len(headers) == 0 || len(rows) == 0 {
		return LastResultsWinner{}, false
	}
	posCol := summaryCol(headers, "Pos", "Pos.")
	teamCol := summaryCol(headers, "Team")
	carCol := summaryCol(headers, "Car #", "Car No", "Car No.", "No.", "No")
	var winner []string
	for _, row := range rows {
		if posCol >= 0 && summaryIsP1(summaryCell(row, posCol)) {
			winner = row
			break
		}
	}
	if winner == nil {
		winner = rows[0]
	}
	team := summaryCell(winner, teamCol)
	if team == "" {
		return LastResultsWinner{}, false
	}
	return LastResultsWinner{Name: team, Car: summaryCell(winner, carCol), Label: label}, true
}

func summaryTgaFlatWinner(table map[string]interface{}, label string) (LastResultsWinner, bool) {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	if len(headers) == 0 || len(rows) == 0 {
		return LastResultsWinner{}, false
	}
	drvCol := summaryCol(headers, "DRIVERS", "Drivers", "DRIVER", "Driver")
	carCol := summaryCol(headers, "CAR NO", "Car No", "Car No.", "No.", "No", "Car #")
	posCol := summaryCol(headers, "POS", "Pos", "Pos.", "OVERALL POS", "Overall")
	if drvCol < 0 {
		return LastResultsWinner{}, false
	}
	var winner []string
	for _, row := range rows {
		if posCol >= 0 && summaryIsP1(summaryCell(row, posCol)) {
			winner = row
			break
		}
	}
	if winner == nil {
		winner = rows[0]
	}
	name := strings.Join(splitSemiCrew(summaryCell(winner, drvCol)), " / ")
	if name == "" {
		return LastResultsWinner{}, false
	}
	return LastResultsWinner{Name: name, Car: summaryCell(winner, carCol), Label: label}, true
}

func splitSemiCrew(s string) []string {
	parts := strings.Split(s, ";")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func summaryAllstarWinner(rr map[string]interface{}, label string) (LastResultsWinner, bool) {
	stages, _ := rr["stages"].([]interface{})
	var final map[string]interface{}
	for i := len(stages) - 1; i >= 0; i-- {
		st, ok := stages[i].(map[string]interface{})
		if !ok {
			continue
		}
		title := strings.ToLower(summaryAsString(st["title"]))
		if strings.Contains(title, "final") {
			final = st
			break
		}
	}
	if final == nil && len(stages) > 0 {
		final, _ = stages[len(stages)-1].(map[string]interface{})
	}
	if final == nil {
		return LastResultsWinner{}, false
	}
	return summaryDriverWinner(final, label)
}

func summarySessionLabel(sess map[string]interface{}) string {
	meta, _ := sess["meta"].(map[string]interface{})
	raw := ""
	if meta != nil {
		raw = summaryAsString(meta["Session"])
	}
	title := summaryAsString(sess["title"])
	if raw == "" || strings.EqualFold(raw, "Race") {
		if title != "" {
			raw = title
		}
	}
	label := strings.TrimSpace(raw)
	label = strings.TrimSpace(reTrimResults.ReplaceAllString(label, ""))
	if m := reRaceRound.FindStringSubmatch(label); len(m) == 2 {
		return m[1]
	}
	if m := reRaceN.FindStringSubmatch(label); len(m) == 2 {
		return m[1]
	}
	label = strings.TrimSpace(reTrimRace.ReplaceAllString(label, ""))
	return strings.TrimSpace(label)
}

func f1RaceBlockIsSprintSessionsOnly(raceAny interface{}) bool {
	race, ok := raceAny.(map[string]interface{})
	if !ok || race == nil {
		return false
	}
	sessions := summarySessions(race)
	if len(sessions) == 0 {
		return false
	}
	anyRows := false
	for _, sess := range sessions {
		if len(summaryRows(sess)) == 0 {
			continue
		}
		anyRows = true
		raw := summaryAsString(sess["title"])
		if meta, ok := sess["meta"].(map[string]interface{}); ok {
			if s := summaryAsString(meta["Session"]); s != "" {
				raw = s
			}
		}
		if !strings.Contains(strings.ToLower(raw), "sprint") {
			return false
		}
	}
	return anyRows
}

func summaryCancelledText(text string) bool {
	s := strings.ToLower(strings.TrimSpace(text))
	if s == "" {
		return false
	}
	if strings.Contains(s, "race cancelled") || strings.Contains(s, "race canceled") {
		return true
	}
	if strings.Contains(s, "cancelled") && strings.Contains(s, "weather") {
		return true
	}
	return strings.Contains(s, "canceled") && strings.Contains(s, "weather")
}

func summaryRaceCancelled(tables map[string]interface{}) bool {
	race, _ := tables["race"].(map[string]interface{})
	if race == nil {
		return false
	}
	if summaryCancelledText(summaryAsString(race["note"])) || summaryCancelledText(summaryAsString(race["subtitle"])) {
		return true
	}
	if lines, ok := race["note_lines"].([]interface{}); ok {
		for _, ln := range lines {
			if summaryCancelledText(summaryAsString(ln)) {
				return true
			}
		}
	}
	for _, sess := range summarySessions(race) {
		if summaryCancelledText(summaryAsString(sess["note"])) || summaryCancelledText(summaryAsString(sess["subtitle"])) {
			return true
		}
		if lines, ok := sess["note_lines"].([]interface{}); ok {
			for _, ln := range lines {
				if summaryCancelledText(summaryAsString(ln)) {
					return true
				}
			}
		}
	}
	return false
}

func summaryParseMetaDate(metaDate string) string {
	s := strings.TrimSpace(metaDate)
	if s == "" {
		return ""
	}
	if m := reISODate.FindStringSubmatch(s); len(m) == 2 {
		return m[1]
	}
	return ""
}

func summaryRaceDateRange(tables map[string]interface{}, root map[string]interface{}) (start, end string) {
	bump := func(iso string) {
		if iso == "" {
			return
		}
		if start == "" || iso < start {
			start = iso
		}
		if end == "" || iso > end {
			end = iso
		}
	}
	if race, ok := tables["race"].(map[string]interface{}); ok {
		for _, sess := range summarySessions(race) {
			if meta, ok := sess["meta"].(map[string]interface{}); ok {
				bump(summaryParseMetaDate(summaryAsString(meta["Date"])))
			}
		}
	}
	if rr, ok := tables["race_results"].(map[string]interface{}); ok {
		if meta, ok := rr["meta"].(map[string]interface{}); ok {
			bump(summaryParseMetaDate(summaryAsString(meta["Date"])))
		}
	}
	if start == "" {
		bump(summaryParseMetaDate(summaryAsString(root["date"])))
		bump(summaryParseMetaDate(summaryAsString(root["start_date"])))
		bump(summaryParseMetaDate(summaryAsString(root["end_date"])))
	}
	if start != "" && end == "" {
		end = start
	}
	if end != "" && start == "" {
		start = end
	}
	return start, end
}

func summaryWecClassWinners(table map[string]interface{}) []LastResultsWinner {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	classIdx := summaryCol(headers, "Class")
	teamIdx := summaryCol(headers, "Team")
	noIdx := summaryCol(headers, "No.", "No")
	posIdx := summaryCol(headers, "Pos", "Pos.")
	if classIdx < 0 || teamIdx < 0 {
		return nil
	}
	wantOrder := []string{"hypercar", "lmp2", "lmgt3"}
	labelByKey := map[string]string{"hypercar": "Hypercar", "lmp2": "LMP2", "lmgt3": "LMGT3"}
	seen := map[string]LastResultsWinner{}
	for _, row := range rows {
		clsRaw := strings.ToLower(summaryCell(row, classIdx))
		key := ""
		switch clsRaw {
		case "hypercar", "lmp2", "lmgt3":
			key = clsRaw
		}
		if key == "" {
			continue
		}
		if _, ok := seen[key]; ok {
			continue
		}
		posCell := strings.ToUpper(summaryCell(row, posIdx))
		if posCell == "" && len(row) > 0 {
			posCell = strings.ToUpper(row[0])
		}
		if posCell == "RET" || strings.HasPrefix(posCell, "RET") || posCell == "DNF" {
			continue
		}
		seen[key] = LastResultsWinner{
			Name:  summaryCell(row, teamIdx),
			Car:   summaryCell(row, noIdx),
			Label: labelByKey[key],
		}
	}
	out := make([]LastResultsWinner, 0, 3)
	for _, key := range wantOrder {
		if w, ok := seen[key]; ok {
			out = append(out, w)
		}
	}
	return out
}

func summaryImsaClassWinners(table map[string]interface{}) []LastResultsWinner {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	upper := make([]string, len(headers))
	for i, h := range headers {
		upper[i] = strings.ToUpper(strings.TrimSpace(h))
	}
	clsCol, clsPosCol, carCol, teamCarCol := -1, -1, -1, -1
	for i, h := range upper {
		switch h {
		case "CLASS":
			clsCol = i
		case "CLASS POS":
			clsPosCol = i
		case "CAR NO":
			carCol = i
		case "TEAM/CAR/SPONSOR", "TEAM/CAR":
			if teamCarCol < 0 {
				teamCarCol = i
			}
		}
	}
	if clsCol < 0 || clsPosCol < 0 {
		return nil
	}
	want := []string{"GTP", "LMP2", "GTD PRO", "GTD"}
	best := map[string][]string{}
	for _, row := range rows {
		cls := strings.ToUpper(summaryCell(row, clsCol))
		okWant := false
		for _, w := range want {
			if cls == w {
				okWant = true
				break
			}
		}
		if !okWant || !summaryIsP1(summaryCell(row, clsPosCol)) {
			continue
		}
		if _, exists := best[cls]; !exists {
			best[cls] = row
		}
	}
	out := make([]LastResultsWinner, 0, 4)
	for _, cls := range want {
		row := best[cls]
		if row == nil {
			continue
		}
		teamLine := summaryCell(row, teamCarCol)
		if i := strings.Index(teamLine, "/"); i >= 0 {
			teamLine = strings.TrimSpace(teamLine[:i])
		}
		label := cls
		if cls == "GTD PRO" {
			label = "GTD Pro"
		}
		out = append(out, LastResultsWinner{Name: teamLine, Car: summaryCell(row, carCol), Label: label})
	}
	return out
}

func summaryElmsClassWinners(table map[string]interface{}, entryList []interface{}) []LastResultsWinner {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	clsCol := summaryCol(headers, "Class")
	posCol := summaryCol(headers, "Pos", "Pos.")
	noCol := summaryCol(headers, "No", "No.")
	teamCol := summaryCol(headers, "Team")
	if clsCol < 0 {
		return nil
	}
	classOrder := []string{"LMP2", "LMP2 Pro/Am", "LMP3", "LMGT3"}
	winnerByClass := map[string][]string{}
	for _, row := range rows {
		cls := summaryCell(row, clsCol)
		ok := false
		for _, c := range classOrder {
			if cls == c {
				ok = true
				break
			}
		}
		if !ok {
			continue
		}
		posVal := summaryCell(row, posCol)
		if winnerByClass[cls] == nil || summaryIsP1(posVal) {
			winnerByClass[cls] = row
		}
	}
	entryTeam := map[string]string{}
	for _, e := range entryList {
		m, ok := e.(map[string]interface{})
		if !ok {
			continue
		}
		num := strings.TrimSpace(summaryAsString(m["number"]))
		team := strings.TrimSpace(summaryAsString(m["team"]))
		if num != "" && team != "" {
			entryTeam[num] = team
		}
	}
	out := make([]LastResultsWinner, 0, 4)
	for _, cls := range classOrder {
		row := winnerByClass[cls]
		if row == nil {
			continue
		}
		team := summaryCell(row, teamCol)
		car := summaryCell(row, noCol)
		if team == "" {
			team = entryTeam[car]
		}
		out = append(out, LastResultsWinner{Name: team, Car: car, Label: cls})
	}
	return out
}

func summarySuperGtClassWinners(table map[string]interface{}) []LastResultsWinner {
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	clsCol := summaryCol(headers, "Class")
	posCol := summaryCol(headers, "Pos", "Pos.", "Class Pos", "CLASS POS")
	drvCol := summaryCol(headers, "Driver", "Drivers", "DRIVERS")
	teamCol := summaryCol(headers, "Team")
	noCol := summaryCol(headers, "No.", "No", "Car #", "Car No")
	if clsCol < 0 {
		return nil
	}
	want := []string{"GT500", "GT300"}
	best := map[string][]string{}
	for _, row := range rows {
		cls := strings.ToUpper(summaryCell(row, clsCol))
		if cls != "GT500" && cls != "GT300" {
			continue
		}
		if _, exists := best[cls]; !exists {
			best[cls] = row
		} else if posCol >= 0 && summaryIsP1(summaryCell(row, posCol)) {
			best[cls] = row
		}
	}
	out := make([]LastResultsWinner, 0, 2)
	for _, cls := range want {
		row := best[cls]
		if row == nil {
			continue
		}
		name := strings.Join(splitSemiCrew(summaryCell(row, drvCol)), " / ")
		if name == "" {
			name = summaryCell(row, teamCol)
		}
		out = append(out, LastResultsWinner{Name: name, Car: summaryCell(row, noCol), Label: cls})
	}
	return out
}

func summaryGtwceEndWinners(race map[string]interface{}, root map[string]interface{}) []LastResultsWinner {
	sessions := summarySessions(race)
	var table map[string]interface{}
	if len(sessions) > 0 {
		table = sessions[0]
		for _, sess := range sessions {
			title := strings.ToLower(summarySessionLabel(sess) + " " + summaryAsString(sess["title"]))
			if strings.Contains(title, "main") || strings.Contains(title, "race") {
				table = sess
				break
			}
		}
	} else {
		table = race
	}
	headers := summaryHeaders(table)
	rows := summaryRows(table)
	if len(rows) == 0 {
		return nil
	}
	teamCol := summaryCol(headers, "Team")
	carCol := summaryCol(headers, "Car #", "Car No", "Car No.", "No.", "No")
	clsCol := summaryCol(headers, "Class", "Cat", "Category")
	out := []LastResultsWinner{}
	if w, ok := summaryTeamPosWinner(table, "Overall"); ok {
		out = append(out, w)
	}
	spa24 := summaryIsGtwceSpa24(root)
	cups := []string{"Gold", "Silver", "Bronze"}
	if spa24 {
		cups = append(cups, "Pro-Am")
	}
	seenCup := map[string]bool{}
	for _, row := range rows {
		if clsCol < 0 {
			break
		}
		cls := summaryCell(row, clsCol)
		cup := ""
		for _, c := range cups {
			if strings.EqualFold(cls, c) || strings.EqualFold(cls, c+" Cup") {
				cup = c
				break
			}
		}
		if cup == "" || seenCup[cup] {
			continue
		}
		seenCup[cup] = true
		out = append(out, LastResultsWinner{
			Name:  summaryCell(row, teamCol),
			Car:   summaryCell(row, carCol),
			Label: cup,
		})
	}
	return out
}

func summaryIsGtwceSpa24(root map[string]interface{}) bool {
	race := strings.ToLower(summaryAsString(root["race"]) + " " + summaryAsString(root["name"]))
	track := strings.ToLower(summaryAsString(root["track"]) + " " + summaryAsString(root["circuit_name"]))
	if strings.Contains(race, "24 hours of spa") {
		return true
	}
	if strings.Contains(race, "crowdstrike") && strings.Contains(race, "spa") && strings.Contains(race, "24") {
		return true
	}
	return strings.Contains(track, "spa") && strings.Contains(race, "24")
}
