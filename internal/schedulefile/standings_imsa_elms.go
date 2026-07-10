package schedulefile

import (
	"sort"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
)

type classCarAcc struct {
	car, driver, team, manufacturer string
	races, quals                    map[string]string
	points                          float64
}

func imsaStandingsRaceCode(ev EventJSON) string {
	hay := strings.ToLower(strings.TrimSpace(ev.CircuitName) + " " + strings.TrimSpace(ev.Name) + " " + strings.TrimSpace(ev.Location))
	switch {
	case strings.Contains(hay, "daytona"):
		return "DAY24"
	case strings.Contains(hay, "sebring"):
		return "SEB12"
	case strings.Contains(hay, "long beach"):
		return "LB"
	case strings.Contains(hay, "laguna") || strings.Contains(hay, "monterey"):
		return "MON"
	case strings.Contains(hay, "detroit"):
		return "DET"
	case strings.Contains(hay, "watkins"):
		return "WG"
	case strings.Contains(hay, "canadian tire") || strings.Contains(hay, "mosport"):
		return "CTMP"
	case strings.Contains(hay, "road america"):
		return "RA"
	case strings.Contains(hay, "virginia") || strings.Contains(hay, " vir"):
		return "VIR"
	case strings.Contains(hay, "indianapolis"):
		return "IMS"
	case strings.Contains(hay, "road atlanta") || strings.Contains(hay, "petit le mans"):
		return "PLM"
	}
	if n, ok := eventRoundNumber(ev.ID); ok {
		return "R" + strconv.Itoa(n)
	}
	return "R"
}

func elmsStandingsRaceCode(ev EventJSON) string {
	hay := strings.ToLower(strings.TrimSpace(ev.CircuitName) + " " + strings.TrimSpace(ev.Name) + " " + strings.TrimSpace(ev.Location))
	switch {
	case strings.Contains(hay, "barcelona") || strings.Contains(hay, "montmel"):
		return "BAR"
	case strings.Contains(hay, "ricard") || strings.Contains(hay, "castellet"):
		return "LEC"
	case strings.Contains(hay, "imola"):
		return "IMO"
	case strings.Contains(hay, "spa"):
		return "SPA"
	case strings.Contains(hay, "silverstone"):
		return "SIL"
	case strings.Contains(hay, "portim") || strings.Contains(hay, "algarve"):
		return "ALG"
	}
	if n, ok := eventRoundNumber(ev.ID); ok {
		return "R" + strconv.Itoa(n)
	}
	return "R"
}

func isImsaChampionshipEvent(ev EventJSON) bool {
	id := strings.ToUpper(strings.TrimSpace(ev.ID))
	if strings.Contains(id, "PRE_SEASON") || strings.Contains(id, "PRESEASON") {
		return false
	}
	n, ok := eventRoundNumber(ev.ID)
	return ok && n > 0
}

func isElmsChampionshipEvent(ev EventJSON) bool {
	id := strings.ToUpper(strings.TrimSpace(ev.ID))
	if strings.Contains(id, "PROLOGUE") {
		return false
	}
	n, ok := eventRoundNumber(ev.ID)
	return ok && n > 0
}

func carNumbersMatch(a, b string) bool {
	a = strings.TrimSpace(a)
	b = strings.TrimSpace(b)
	if a == b {
		return true
	}
	if isAllDigits(a) && isAllDigits(b) {
		return atoiSafe(a) == atoiSafe(b)
	}
	return false
}

func imsaCarAliases(roundCode, cls, car string) []string {
	out := []string{strings.TrimSpace(car)}
	if roundCode == "DAY24" && cls == "GTP" {
		if car == "5" {
			out = append(out, "85")
		}
		if car == "85" {
			out = append(out, "5")
		}
	}
	seen := map[string]struct{}{}
	var deduped []string
	for _, c := range out {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		deduped = append(deduped, c)
	}
	return deduped
}

func imsaEntryNumericCarConflicts(entryList []EntryListRow) map[int]bool {
	counts := make(map[int]int)
	for _, e := range entryList {
		n := atoiSafe(strings.TrimSpace(e.Number))
		if n <= 0 {
			continue
		}
		counts[n]++
	}
	out := make(map[int]bool)
	for n, c := range counts {
		if c > 1 {
			out[n] = true
		}
	}
	return out
}

func imsaRowMatchesCar(roundCode, cls, standingsCar, eventCar string, strictOnly bool) bool {
	for _, c := range imsaCarAliases(roundCode, cls, standingsCar) {
		if strictOnly {
			if strings.TrimSpace(c) == strings.TrimSpace(eventCar) {
				return true
			}
			continue
		}
		if carNumbersMatch(c, eventCar) {
			return true
		}
	}
	return false
}

func mergeDriverNames(existing string, additions ...string) string {
	seen := map[string]struct{}{}
	var out []string
	add := func(raw string) {
		for _, n := range splitDriversCell(raw) {
			key := canonicalDriverKey(n)
			if _, ok := seen[key]; ok {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, n)
		}
	}
	add(existing)
	for _, a := range additions {
		add(a)
	}
	return strings.Join(out, " / ")
}

func normalizeImsaClassFromEntry(entryClass, raceClass string) string {
	ec := strings.TrimSpace(entryClass)
	rc := strings.TrimSpace(raceClass)
	if ec != "" {
		return ec
	}
	if rc == "GTD" {
		return "GTD"
	}
	return rc
}

func imsaAlternateClass(cls string) string {
	switch cls {
	case "GTD Pro":
		return "GTD"
	case "GTD":
		return "GTD Pro"
	default:
		return ""
	}
}

func imsaClassMatchesStandings(standingsClass, rowClass string) bool {
	rowClass = strings.TrimSpace(rowClass)
	if rowClass == standingsClass {
		return true
	}
	alt := imsaAlternateClass(standingsClass)
	return alt != "" && rowClass == alt
}

func imsaFindTableRow(headers []string, rows [][]string, roundCode, cls, car string, requireClassCol bool, numericConflicts map[int]bool, allowClassAlternate bool) []string {
	icar := firstColIndex(headers, "CAR NO", "Car No", "No.", "No", "#", "Car")
	icls := firstColIndex(headers, "CLASS", "Class")
	if icar < 0 {
		return nil
	}
	if requireClassCol && icls < 0 {
		return nil
	}
	strictOnly := numericConflicts != nil && numericConflicts[atoiSafe(car)]
	for _, row := range rows {
		if icar >= len(row) {
			continue
		}
		if icls >= 0 {
			if icls >= len(row) {
				continue
			}
			rowCls := strings.TrimSpace(row[icls])
			if allowClassAlternate {
				if !imsaClassMatchesStandings(cls, rowCls) {
					continue
				}
			} else if rowCls != cls {
				continue
			}
		}
		if !imsaRowMatchesCar(roundCode, cls, car, row[icar], strictOnly) {
			continue
		}
		return row
	}
	return nil
}

func imsaRaceCellFromRow(headers []string, row []string) string {
	if row == nil {
		return ""
	}
	icp := firstColIndex(headers, "CLASS POS", "Class Pos")
	istat := firstColIndex(headers, "STATUS", "Status")
	if istat >= 0 && istat < len(row) {
		st := strings.ToUpper(strings.TrimSpace(row[istat]))
		if strings.Contains(st, "DNS") || strings.Contains(st, "WD") || strings.Contains(st, "OUT") {
			return "DNS"
		}
	}
	if icp >= 0 && icp < len(row) {
		p := strings.TrimSpace(row[icp])
		if p != "" {
			return p
		}
	}
	return ""
}

func imsaRacePointsFromRow(headers []string, row []string) float64 {
	if row == nil {
		return 0
	}
	istat := firstColIndex(headers, "STATUS", "Status")
	if istat >= 0 && istat < len(row) {
		st := strings.ToUpper(strings.TrimSpace(row[istat]))
		if strings.Contains(st, "DNS") {
			ipts := firstColIndex(headers, "PTS", "Pts", "Points")
			if ipts >= 0 && ipts < len(row) {
				if v := parseGtwcePointsCell(row[ipts]); v > 0 {
					return v
				}
			}
			return 19
		}
	}
	ipts := firstColIndex(headers, "PTS", "Pts", "Points")
	if ipts >= 0 && ipts < len(row) {
		if v := parseGtwcePointsCell(row[ipts]); v > 0 {
			return v
		}
	}
	icp := firstColIndex(headers, "CLASS POS", "Class Pos")
	if icp >= 0 && icp < len(row) {
		return imsaRacePointsByPos(atoiSafe(row[icp]))
	}
	return 0
}

func imsaQualPointsFromRow(headers []string, row []string) float64 {
	if row == nil {
		return 0
	}
	icp := firstColIndex(headers, "CLASS POS", "Class Pos")
	if icp >= 0 {
		if icp >= len(row) {
			return 0
		}
		return imsaQualifyingPointsByPos(atoiSafe(strings.TrimSpace(row[icp])))
	}
	ipos := firstColIndex(headers, "POS", "Pos")
	if ipos >= 0 && ipos < len(row) {
		return imsaQualifyingPointsByPos(atoiSafe(row[ipos]))
	}
	return 0
}

func imsaQualCellFromRow(headers []string, row []string) string {
	if row == nil {
		return ""
	}
	icp := firstColIndex(headers, "CLASS POS", "Class Pos")
	if icp >= 0 {
		if icp < len(row) {
			return strings.TrimSpace(row[icp])
		}
		return ""
	}
	ipos := firstColIndex(headers, "POS", "Pos")
	if ipos >= 0 && ipos < len(row) {
		return strings.TrimSpace(row[ipos])
	}
	return ""
}

func elmsEntryDrivers(e EntryListRow) string {
	var parts []string
	for _, d := range []string{e.Driver1, e.Driver2, e.Driver3, e.Driver} {
		d = strings.TrimSpace(d)
		if d == "" || d == "-" {
			continue
		}
		parts = append(parts, d)
	}
	return strings.Join(parts, " / ")
}

func elmsEntryClassByCar(detail *EventDetailJSON) map[string]string {
	out := make(map[string]string)
	if detail == nil {
		return out
	}
	for _, e := range detail.EntryList {
		car := strings.TrimSpace(e.Number)
		cls := strings.TrimSpace(e.Class)
		if car == "" || cls == "" {
			continue
		}
		out[car] = cls
	}
	return out
}

func elmsEntryMetaByCar(detail *EventDetailJSON) map[string]struct {
	team, drivers, manufacturer string
} {
	out := make(map[string]struct {
		team, drivers, manufacturer string
	})
	if detail == nil {
		return out
	}
	for _, e := range detail.EntryList {
		car := strings.TrimSpace(e.Number)
		if car == "" {
			continue
		}
		manu := strings.TrimSpace(e.Car)
		if manu == "" {
			manu = strings.TrimSpace(e.Manufacturer)
		}
		out[car] = struct {
			team, drivers, manufacturer string
		}{
			team:         strings.TrimSpace(e.Team),
			drivers:      elmsEntryDrivers(e),
			manufacturer: manu,
		}
	}
	return out
}

type elmsSessRow struct {
	carNum, cls, team, drivers, manufacturer string
	posNum                                   int
	posIsNC                                  bool
	posRaw                                   string
	points                                   float64
}

func elmsClassRankInSession(rows []elmsSessRow, cls string) map[string]string {
	out := make(map[string]string)
	var sub []elmsSessRow
	for i := range rows {
		if rows[i].cls == cls {
			sub = append(sub, rows[i])
		}
	}
	sort.Slice(sub, func(i, j int) bool {
		if sub[i].posIsNC != sub[j].posIsNC {
			return !sub[i].posIsNC
		}
		if sub[i].posIsNC {
			return false
		}
		return sub[i].posNum < sub[j].posNum
	})
	rank := 1
	for _, r := range sub {
		if r.posIsNC {
			d := strings.TrimSpace(r.posRaw)
			if d == "" {
				d = "NC"
			}
			out[r.carNum] = d
			continue
		}
		out[r.carNum] = strconv.Itoa(rank)
		rank++
	}
	return out
}

func classCarKey(cls, car string) string {
	return cls + "\x00" + strings.TrimSpace(car)
}

func imsaClassMeta() []struct{ id, name string } {
	return []struct{ id, name string }{
		{"GTP", "Grand Touring Prototype (GTP)"},
		{"LMP2", "Le Mans Prototype 2 (LMP2)"},
		{"GTD Pro", "GT Daytona Pro (GTD Pro)"},
		{"GTD", "GT Daytona (GTD)"},
	}
}

func elmsClassMeta() []struct{ id, name string } {
	return []struct{ id, name string }{
		{"LMP2", "Le Mans Prototype 2 (LMP2)"},
		{"LMP2 Pro/Am", "Le Mans Prototype 2 Pro/Am (LMP2 Pro/Am)"},
		{"LMP3", "Le Mans Prototype 3 (LMP3)"},
		{"LMGT3", "Le Mans GT3 (LMGT3)"},
	}
}

func accFromBuckets(buckets map[string]*classCarAcc, cls string, raceOrder []string) []StandingRow {
	var keys []string
	for k, a := range buckets {
		if a == nil || !strings.HasPrefix(k, cls+"\x00") {
			continue
		}
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		pi := buckets[keys[i]].points
		pj := buckets[keys[j]].points
		if pi != pj {
			return pi > pj
		}
		return naturalCarLess(buckets[keys[i]].car, buckets[keys[j]].car)
	})
	out := make([]StandingRow, 0, len(keys))
	for i, k := range keys {
		a := buckets[k]
		raceStr := make(map[string]string)
		for _, code := range raceOrder {
			if v, ok := a.races[code]; ok && v != "" {
				raceStr[code] = v
			}
		}
		qualStr := make(map[string]string)
		for _, code := range raceOrder {
			if v, ok := a.quals[code]; ok && v != "" {
				qualStr[code] = v
			}
		}
		row := StandingRow{
			Pos:          i + 1,
			Car:          a.car,
			Driver:       a.driver,
			Team:         a.team,
			Manufacturer: a.manufacturer,
			Points:       formatGtwcePtsTotal(a.points),
			Races:        raceStr,
		}
		if len(qualStr) > 0 {
			row.Quals = qualStr
		}
		out = append(out, row)
	}
	return out
}

// BuildImsaStandingsFromEvents builds per-class IMSA standings from tables.race and tables.qualifying.
func BuildImsaStandingsFromEvents(dataDir string, season string) (*StandingsData, error) {
	return buildImsaStandingsFromEvents(dataDir, season, 0)
}

func buildImsaStandingsFromEvents(dataDir string, season string, maxRound int) (*StandingsData, error) {
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, "IMSA")
	if err != nil || len(events) == 0 {
		return &StandingsData{Classes: []StandingsClass{}}, nil
	}
	var champs []EventJSON
	for _, ev := range events {
		if ev.Season != season || !isImsaChampionshipEvent(ev) {
			continue
		}
		if maxRound > 0 {
			n, ok := eventRoundNumber(ev.ID)
			if ok && n > maxRound {
				continue
			}
		}
		champs = append(champs, ev)
	}
	sort.Slice(champs, func(i, j int) bool {
		ri, _ := eventRoundNumber(champs[i].ID)
		rj, _ := eventRoundNumber(champs[j].ID)
		return ri < rj
	})
	if len(champs) == 0 {
		return &StandingsData{Classes: []StandingsClass{}}, nil
	}

	var raceOrder, eventNames []string
	for _, ev := range champs {
		raceOrder = append(raceOrder, imsaStandingsRaceCode(ev))
		eventNames = append(eventNames, strings.TrimSpace(ev.Name))
	}

	buckets := make(map[string]*classCarAcc)
	getAcc := func(cls, car string) *classCarAcc {
		k := classCarKey(cls, car)
		if buckets[k] == nil {
			buckets[k] = &classCarAcc{
				car:   strings.TrimSpace(car),
				races: make(map[string]string),
				quals: make(map[string]string),
			}
		}
		return buckets[k]
	}

	completedSet := map[string]bool{}

	for _, ev := range champs {
		code := imsaStandingsRaceCode(ev)
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil {
			continue
		}
		for _, e := range detail.EntryList {
			car := strings.TrimSpace(e.Number)
			cls := normalizeImsaClassFromEntry(e.Class, "")
			if car == "" || cls == "" {
				continue
			}
			a := getAcc(cls, car)
			manu := strings.TrimSpace(e.Car)
			if manu == "" {
				manu = strings.TrimSpace(e.Manufacturer)
			}
			a.driver = mergeDriverNames(a.driver, e.Driver)
			if strings.TrimSpace(e.Team) != "" {
				a.team = strings.TrimSpace(e.Team)
			}
			if manu != "" {
				a.manufacturer = manu
			}
		}

		race, ok := detail.Tables["race"]
		if !ok || len(race.Headers) == 0 || len(race.Rows) == 0 {
			continue
		}
		completedSet[code] = true
		entryClass := elmsEntryClassByCar(detail)

		for _, row := range race.Rows {
			icar := firstColIndex(race.Headers, "CAR NO", "Car No", "No.", "No", "#", "Car")
			icls := firstColIndex(race.Headers, "CLASS", "Class")
			if icar < 0 || icls < 0 || icar >= len(row) || icls >= len(row) {
				continue
			}
			eventCar := strings.TrimSpace(row[icar])
			rowCls := strings.TrimSpace(row[icls])
			if eventCar == "" || rowCls == "" {
				continue
			}
			cls := rowCls
			if ec, ok := entryClass[eventCar]; ok && ec != "" {
				cls = normalizeImsaClassFromEntry(ec, rowCls)
			}
			a := getAcc(cls, eventCar)
			cell := imsaRaceCellFromRow(race.Headers, row)
			if cell != "" {
				a.races[code] = cell
			}
			a.points += imsaRacePointsFromRow(race.Headers, row)
			if drv := strings.TrimSpace(valueAt(row, firstColIndex(race.Headers, "DRIVERS", "Drivers", "Driver"))); drv != "" {
				a.driver = mergeDriverNames(a.driver, drv)
			}
		}

		if qual, ok := detail.Tables["qualifying"]; ok && len(qual.Headers) > 0 && len(qual.Rows) > 0 {
			hasClassCol := firstColIndex(qual.Headers, "CLASS", "Class") >= 0
			numericConflicts := imsaEntryNumericCarConflicts(detail.EntryList)
			for _, e := range detail.EntryList {
				car := strings.TrimSpace(e.Number)
				cls := normalizeImsaClassFromEntry(e.Class, "")
				if car == "" || cls == "" {
					continue
				}
				a := getAcc(cls, car)
				qrow := imsaFindTableRow(qual.Headers, qual.Rows, code, cls, car, hasClassCol, numericConflicts, false)
				if qrow == nil {
					continue
				}
				qcell := imsaQualCellFromRow(qual.Headers, qrow)
				if qcell != "" {
					a.quals[code] = qcell
				}
				a.points += imsaQualPointsFromRow(qual.Headers, qrow)
			}
		}
	}

	completed := make([]string, 0, len(raceOrder))
	for _, c := range raceOrder {
		if completedSet[c] {
			completed = append(completed, c)
		}
	}

	var classes []StandingsClass
	for _, cm := range imsaClassMeta() {
		rows := accFromBuckets(buckets, cm.id, raceOrder)
		if len(rows) == 0 {
			continue
		}
		classes = append(classes, StandingsClass{ID: cm.id, Name: cm.name, Rows: rows})
	}

	return &StandingsData{
		RaceOrder:      raceOrder,
		EventNames:     eventNames,
		CompletedRaces: completed,
		Rows:           []StandingRow{},
		Classes:        classes,
	}, nil
}

// BuildElmsStandingsFromEvents builds per-class ELMS standings from tables.race.
func BuildElmsStandingsFromEvents(dataDir string, season string) (*StandingsData, error) {
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, "ELMS")
	if err != nil || len(events) == 0 {
		return &StandingsData{Classes: []StandingsClass{}}, nil
	}
	var champs []EventJSON
	for _, ev := range events {
		if ev.Season != season || !isElmsChampionshipEvent(ev) {
			continue
		}
		champs = append(champs, ev)
	}
	sort.Slice(champs, func(i, j int) bool {
		ri, _ := eventRoundNumber(champs[i].ID)
		rj, _ := eventRoundNumber(champs[j].ID)
		return ri < rj
	})
	if len(champs) == 0 {
		return &StandingsData{Classes: []StandingsClass{}}, nil
	}

	var raceOrder, eventNames []string
	for _, ev := range champs {
		raceOrder = append(raceOrder, elmsStandingsRaceCode(ev))
		eventNames = append(eventNames, strings.TrimSpace(ev.Name))
	}

	buckets := make(map[string]*classCarAcc)
	getAcc := func(cls, car string) *classCarAcc {
		k := classCarKey(cls, car)
		if buckets[k] == nil {
			buckets[k] = &classCarAcc{
				car:   strings.TrimSpace(car),
				races: make(map[string]string),
				quals: make(map[string]string),
			}
		}
		return buckets[k]
	}

	completedSet := map[string]bool{}

	for _, ev := range champs {
		code := elmsStandingsRaceCode(ev)
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil {
			continue
		}
		entryMeta := elmsEntryMetaByCar(detail)
		entryClass := elmsEntryClassByCar(detail)
		for car, meta := range entryMeta {
			cls := entryClass[car]
			if cls == "" {
				continue
			}
			a := getAcc(cls, car)
			a.driver = mergeDriverNames(a.driver, meta.drivers)
			if meta.team != "" {
				a.team = meta.team
			}
			if meta.manufacturer != "" {
				a.manufacturer = meta.manufacturer
			}
		}

		race, ok := detail.Tables["race"]
		if !ok || len(race.Headers) == 0 || len(race.Rows) == 0 {
			continue
		}
		completedSet[code] = true

		h := race.Headers
		carCol := firstColIndex(h, "No.", "No", "#", "Car")
		classCol := firstColIndex(h, "Class", "CLASS")
		posCol := firstColIndex(h, "Pos", "POS")
		teamCol := colIndex(h, "Team")
		ptsCol := pointsColIndex(h)
		if carCol < 0 || posCol < 0 {
			continue
		}

		var sessRows []elmsSessRow
		for _, row := range race.Rows {
			if carCol >= len(row) {
				continue
			}
			carNum := strings.TrimSpace(row[carCol])
			if carNum == "" {
				continue
			}
			cls := entryClass[carNum]
			if cls == "" && classCol >= 0 && classCol < len(row) {
				cls = strings.TrimSpace(row[classCol])
			}
			if cls == "" {
				continue
			}
			rawPos := valueAt(row, posCol)
			pn, pnc := gtwceParseRacePos(rawPos)
			team := valueAt(row, teamCol)
			meta := entryMeta[carNum]
			pts := 0.0
			if ptsCol >= 0 && ptsCol < len(row) {
				pts = parseGtwcePointsCell(row[ptsCol])
			}
			sessRows = append(sessRows, elmsSessRow{
				carNum: carNum, cls: cls, team: team, drivers: meta.drivers, manufacturer: meta.manufacturer,
				posNum: pn, posIsNC: pnc, posRaw: rawPos, points: pts,
			})
		}

		classesSeen := map[string]struct{}{}
		for _, sr := range sessRows {
			classesSeen[sr.cls] = struct{}{}
		}
		rankByClass := make(map[string]map[string]string)
		for cls := range classesSeen {
			rankByClass[cls] = elmsClassRankInSession(sessRows, cls)
		}

		for _, sr := range sessRows {
			cell := rankByClass[sr.cls][sr.carNum]
			if cell == "" {
				continue
			}
			a := getAcc(sr.cls, sr.carNum)
			a.races[code] = cell
			a.points += sr.points
			if sr.team != "" {
				a.team = sr.team
			}
			if sr.drivers != "" {
				a.driver = mergeDriverNames(a.driver, sr.drivers)
			}
			if sr.manufacturer != "" {
				a.manufacturer = sr.manufacturer
			}
		}
	}

	completed := make([]string, 0, len(raceOrder))
	for _, c := range raceOrder {
		if completedSet[c] {
			completed = append(completed, c)
		}
	}

	var classes []StandingsClass
	for _, cm := range elmsClassMeta() {
		rows := accFromBuckets(buckets, cm.id, raceOrder)
		if len(rows) == 0 {
			continue
		}
		classes = append(classes, StandingsClass{ID: cm.id, Name: cm.name, Rows: rows})
	}

	return &StandingsData{
		RaceOrder:      raceOrder,
		EventNames:     eventNames,
		CompletedRaces: completed,
		Rows:           []StandingRow{},
		Classes:        classes,
	}, nil
}
