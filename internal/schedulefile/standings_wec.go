package schedulefile

import (
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
)

type wecAcc struct {
	team, drivers, carModel string
	racePos                 map[string]string
	points                  float64
}

func wecBucketForClass(cls string) string {
	switch strings.ToUpper(strings.TrimSpace(cls)) {
	case "HYPERCAR":
		return "hypercar"
	case "LMGT3":
		return "lmgt3"
	default:
		return ""
	}
}

func wecChampionshipEvents(events []EventJSON, season string) []struct {
	round int
	ev    EventJSON
} {
	var out []struct {
		round int
		ev    EventJSON
	}
	for _, ev := range events {
		if ev.Season != season {
			continue
		}
		r, ok := eventRoundNumber(ev.ID)
		if !ok {
			continue
		}
		out = append(out, struct {
			round int
			ev    EventJSON
		}{round: r, ev: ev})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].round < out[j].round })
	return out
}

func loadWecEntryBriefByCar(dataDir, eventID string) map[string]struct {
	team, drivers, car, bucket string
} {
	raw, err := ReadEventDetailFile(dataDir, eventID)
	if err != nil || len(raw) == 0 {
		return nil
	}
	var root wecGridRoot
	if json.Unmarshal(raw, &root) != nil {
		return nil
	}
	out := make(map[string]struct {
		team, drivers, car, bucket string
	})
	for _, s := range root.Tables.EntryList.Sessions {
		bucket := wecBucketForClass(s.Title)
		if bucket == "" {
			continue
		}
		idx := map[string]int{}
		for i, h := range s.Headers {
			idx[strings.ToLower(anyToStr(h))] = i
		}
		col := func(name string) int {
			if v, ok := idx[name]; ok {
				return v
			}
			return -1
		}
		noI, drvI := col("no."), col("drivers")
		entrantI, carI := col("entrant"), col("car")
		if noI < 0 || drvI < 0 {
			continue
		}
		var curNum, curTeam, curCar string
		var drivers []string
		flush := func() {
			if curNum == "" {
				return
			}
			e := out[curNum]
			if curTeam != "" {
				e.team = curTeam
			}
			if curCar != "" {
				e.car = curCar
			}
			e.bucket = bucket
			if len(drivers) > 0 {
				e.drivers = strings.Join(drivers, " / ")
			}
			out[curNum] = e
			drivers = nil
		}
		for _, row := range s.Rows {
			if t := cellStr(row, entrantI); t != "" {
				curTeam = t
			}
			if c := cellStr(row, carI); c != "" {
				curCar = c
			}
			no := cellStr(row, noI)
			if no != "" {
				flush()
				curNum = no
			}
			d := cellStr(row, drvI)
			if d != "" {
				drivers = append(drivers, d)
			}
		}
		flush()
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func wecMergeEntryList(dataDir string, champs []struct {
	round int
	ev    EventJSON
}, season string, buckets map[string]map[string]*wecAcc) {
	for _, ce := range champs {
		if ce.ev.Season != season {
			continue
		}
		for num, brief := range loadWecEntryBriefByCar(dataDir, ce.ev.ID) {
			if brief.bucket == "" {
				continue
			}
			b := buckets[brief.bucket]
			if b == nil {
				continue
			}
			if b[num] != nil {
				continue
			}
			b[num] = &wecAcc{
				team:     brief.team,
				drivers:  brief.drivers,
				carModel: brief.car,
				racePos:  make(map[string]string),
			}
		}
	}
}

func wecStandingRowsFromBucket(byCar map[string]*wecAcc, raceOrder []string) []StandingRow {
	if len(byCar) == 0 {
		return nil
	}
	type kv struct {
		car string
		a   *wecAcc
	}
	var list []kv
	for car, a := range byCar {
		if a == nil {
			continue
		}
		list = append(list, kv{car: car, a: a})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].a.points != list[j].a.points {
			return list[i].a.points > list[j].a.points
		}
		return naturalCarLess(list[i].car, list[j].car)
	})
	out := make([]StandingRow, 0, len(list))
	for i, e := range list {
		a := e.a
		raceStr := make(map[string]string)
		for _, code := range raceOrder {
			if v, ok := a.racePos[code]; ok && v != "" {
				raceStr[code] = v
			}
		}
		out = append(out, StandingRow{
			Pos:          i + 1,
			Car:          e.car,
			Driver:       a.drivers,
			Team:         a.team,
			Manufacturer: a.carModel,
			Points:       formatGtwcePtsTotal(a.points),
			Races:        raceStr,
		})
	}
	return out
}

func emptyWecStandings() *StandingsData {
	return &StandingsData{
		RaceOrder:      []string{},
		EventNames:     []string{},
		CompletedRaces: []string{},
		Rows:           []StandingRow{},
		Classes: []StandingsClass{
			{ID: "hypercar", Name: "Hypercar", Rows: []StandingRow{}},
			{ID: "lmgt3", Name: "LMGT3", Rows: []StandingRow{}},
		},
	}
}

// BuildWecStandingsFromEvents builds two tables: Hypercar and LMGT3.
// Points from Pts column in race_results; round cells show class position.
// Prologue and other events without a numeric ID suffix are skipped.
func BuildWecStandingsFromEvents(dataDir string, season string) (*StandingsData, error) {
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, "wec")
	if err != nil || len(events) == 0 {
		return emptyWecStandings(), nil
	}
	champs := wecChampionshipEvents(events, season)
	if len(champs) == 0 {
		return emptyWecStandings(), nil
	}

	var raceOrder []string
	var eventNames []string
	for _, ce := range champs {
		code := "R" + strconv.Itoa(ce.round)
		raceOrder = append(raceOrder, code)
		eventNames = append(eventNames, strings.TrimSpace(ce.ev.Name))
	}

	buckets := map[string]map[string]*wecAcc{
		"hypercar": {},
		"lmgt3":    {},
	}
	completedSet := map[string]bool{}

	for _, ce := range champs {
		code := "R" + strconv.Itoa(ce.round)
		detail, err := LoadEventDetail(dataDir, ce.ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		rr, ok := detail.Tables["race_results"]
		if !ok || len(rr.Headers) == 0 || len(rr.Rows) == 0 {
			continue
		}
		completedSet[code] = true

		h := rr.Headers
		classCol := colIndex(h, "Class")
		carCol := firstColIndex(h, "No.", "No", "#")
		teamCol := colIndex(h, "Team")
		drvCol := colIndex(h, "Drivers")
		if drvCol < 0 {
			drvCol = colIndex(h, "Driver")
		}
		ptsCol := colIndex(h, "Pts")
		if ptsCol < 0 {
			ptsCol = pointsColIndex(h)
		}
		posCol := firstColIndex(h, "Pos", "Pos.")
		if classCol < 0 || carCol < 0 || posCol < 0 {
			continue
		}

		var sessRows []gtwceSessRow
		for _, row := range rr.Rows {
			if classCol >= len(row) || carCol >= len(row) {
				continue
			}
			bName := wecBucketForClass(row[classCol])
			if bName == "" {
				continue
			}
			carNum := strings.TrimSpace(row[carCol])
			if carNum == "" {
				continue
			}
			rawPos := ""
			if posCol < len(row) {
				rawPos = strings.TrimSpace(row[posCol])
			}
			pn, pnc := gtwceParseRacePos(rawPos)
			var pts float64
			if ptsCol >= 0 && ptsCol < len(row) {
				pts = parseGtwcePointsCell(row[ptsCol])
			}
			team := ""
			if teamCol >= 0 && teamCol < len(row) {
				team = strings.TrimSpace(row[teamCol])
			}
			drivers := ""
			if drvCol >= 0 && drvCol < len(row) {
				drivers = strings.TrimSpace(row[drvCol])
			}
			sessRows = append(sessRows, gtwceSessRow{
				carNum: carNum, cls: strings.TrimSpace(row[classCol]), bName: bName,
				posRaw: rawPos, posNum: pn, posIsNC: pnc,
				cupPts: pts, overallPts: pts,
				team: team, drivers: drivers,
			})
		}

		posByBucket := map[string]map[string]string{
			"hypercar": gtwceClassRankInSession(sessRows, "hypercar"),
			"lmgt3":    gtwceClassRankInSession(sessRows, "lmgt3"),
		}

		for _, sr := range sessRows {
			if sr.bName != "hypercar" && sr.bName != "lmgt3" {
				continue
			}
			cell := posByBucket[sr.bName][sr.carNum]
			if cell == "" {
				continue
			}
			b := buckets[sr.bName]
			if b[sr.carNum] == nil {
				b[sr.carNum] = &wecAcc{racePos: make(map[string]string)}
			}
			a := b[sr.carNum]
			if sr.team != "" {
				a.team = sr.team
			}
			if sr.drivers != "" {
				a.drivers = sr.drivers
			}
			a.racePos[code] = cell
			a.points += sr.cupPts
		}
	}

	wecMergeEntryList(dataDir, champs, season, buckets)

	completedOrdered := make([]string, 0, len(raceOrder))
	for _, c := range raceOrder {
		if completedSet[c] {
			completedOrdered = append(completedOrdered, c)
		}
	}

	classMeta := []struct {
		id, tableName string
	}{
		{"hypercar", "Hypercar"},
		{"lmgt3", "LMGT3"},
	}
	var classes []StandingsClass
	for _, cm := range classMeta {
		classes = append(classes, StandingsClass{
			ID:   cm.id,
			Name: cm.tableName,
			Rows: wecStandingRowsFromBucket(buckets[cm.id], raceOrder),
		})
	}

	return &StandingsData{
		RaceOrder:      raceOrder,
		EventNames:     eventNames,
		CompletedRaces: completedOrdered,
		Rows:           []StandingRow{},
		Classes:        classes,
	}, nil
}
