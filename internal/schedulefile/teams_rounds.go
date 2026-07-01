package schedulefile

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// substituteInsertSeries — series with a flat teams table (one driver per row,
// cars identified by number). Participation is grouped BY CAR NUMBER: on
// one car multiple drivers may race in a season (primary + substitutes/one-offs), and
// each is shown as a separate row under that car with their own rounds.
// Substitute drivers are inserted next to the matching number and inherit the car descriptive fields
// (make/team/chassis/engine/full_time) from the matched row, so renderer grouping
// (by team / team+engine / team+car / manufacturer+model) and
// chartered / non-chartered / wildcard logic stay intact.
var substituteInsertSeries = map[string]bool{
	// Stock-car
	"nascar_cup":      true,
	"noaps":           true,
	"nascar_xfinity":  true,
	"nascar_truck":    true,
	"arca":            true,
	"nascar_modified": true,
	// Other single-driver series
	"f1":            true,
	"f2":            true,
	"f3":            true,
	"frec":          true,
	"indycar":       true,
	"super_formula": true,
	"dtm":           true,
	"supercars":     true,
}

// dropPlaceholderSeries — series where the Teams table hides placeholders (driver
// "TBA"/"TBC") and rows without participation data (empty rounds): stock-car and IMSA.
var dropPlaceholderSeries = map[string]bool{
	"nascar_cup":      true,
	"noaps":           true,
	"nascar_xfinity":  true,
	"nascar_truck":    true,
	"arca":            true,
	"nascar_modified": true,
	"imsa":            true,
	"supercars":       true,
}

// placeholderText reports whether a value is a placeholder (TBA/TBC etc.), not real data.
func placeholderText(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "", "tba", "tbc", "tbd", "—", "-":
		return true
	}
	return false
}

// StripDriverParenSuffix removes trailing "(...)" tags (TBA, (i), race counts, etc.).
func StripDriverParenSuffix(name string) string {
	cleaned := name
	for {
		next := driverParenSuffix.ReplaceAllString(cleaned, "")
		if next == cleaned {
			break
		}
		cleaned = next
	}
	return strings.TrimSpace(cleaned)
}

// dropPlaceholderRows removes placeholder rows: driver not set (TBA/TBC) OR no
// participation data (empty/placeholder rounds). For multi-driver rows (IMSA,
// driver in Drivers[]) only rounds is considered.
func dropPlaceholderRows(rows []TeamJSON) []TeamJSON {
	if len(rows) == 0 {
		return rows
	}
	out := rows[:0:0]
	for _, r := range rows {
		multiDriver := strings.TrimSpace(r.Driver) == "" && len(r.Drivers) > 0
		if !multiDriver && placeholderText(StripDriverParenSuffix(r.Driver)) {
			continue
		}
		if placeholderText(r.Rounds) {
			continue
		}
		out = append(out, r)
	}
	return out
}

// gtMultiDriverSeries — series without a curated teams file whose entry_list contains
// class, car, and multiple drivers (driver1/driver2/driver3 or slash-separated string). For them
// the teams table is built from entry_list: one row per car (number).
var gtMultiDriverSeries = map[string]bool{
	"elms":         true,
	"gtwce_end":    true,
	"gtwce_sprint": true,
	"super_gt":     true,
	"wec":          true,
}

// gtClassOrder — class order for sorting rows in built GT/endurance tables.
var gtClassOrder = []string{
	"GTP", "HYPERCAR", "LMH", "LMDH",
	"LMP2", "LMP2 PRO/AM", "LMP3",
	"GT500", "GT300",
	"PRO", "GOLD", "SILVER", "BRONZE", "PRO-AM", "AM",
	"GTD PRO", "GTD", "LMGT3", "GTE",
}

// driverParenSuffix strips parenthetical race tags at the end of a driver name
// ("(i)" — ineligible for points, "(R)" — rookie, etc.) so the same
// driver matches across rounds where the tag is not applied everywhere
// (e.g. "Austin Hill" in R4/R7 and "Austin Hill (i)" in R13 are one driver).
var driverParenSuffix = regexp.MustCompile(`\s*\([^)]*\)\s*$`)

// driverMatchKey normalizes a driver name for matching participation across rounds.
func driverMatchKey(name string) string {
	cleaned := name
	// Strip all trailing "(...)" tags (there may be several in a row).
	for {
		next := driverParenSuffix.ReplaceAllString(cleaned, "")
		if next == cleaned {
			break
		}
		cleaned = next
	}
	return canonicalDriverKey(cleaned)
}

// DriverMatchKey exposes driver name matching for tests and audit tools.
func DriverMatchKey(name string) string { return driverMatchKey(name) }

// eventRoundNumber extracts the championship round number from an event ID
// (integer after the last underscore). Returns ok=false for
// non-numeric suffixes (exhibition rounds like *_allstar_race) and for round 0.
func eventRoundNumber(eventID string) (int, bool) {
	idx := strings.LastIndex(eventID, "_")
	if idx < 0 || idx+1 >= len(eventID) {
		return 0, false
	}
	n, err := strconv.Atoi(eventID[idx+1:])
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

// doubleHeaderRoundSeries — series with double-header rounds where one weekend (the same
// circuit on consecutive schedule slots) = two scoring rounds, but the project
// uses one event file. Participation in that file counts toward ALL rounds
// in its group (e.g. Super Formula: Motegi = rounds 1–2, so one entry_list yields {1,2}).
var doubleHeaderRoundSeries = map[string]bool{
	"super_formula": true,
}

// eventOrdinalSeries — series where schedule/standings track INDIVIDUAL RACES
// (multiple races per weekend), but the Teams table rounds should show by
// WEEKENDS (round = same circuit in a row). Consecutive races at one circuit
// merge into one round with an ordinal number (Sydney=1, Melbourne=2, Taupō=3, …),
// so participation in all held weekends yields compact "1–4" instead of "1–2, 4, 8–9".
var eventOrdinalSeries = map[string]bool{
	"supercars": true,
}

// championshipOrdinalSeries — series whose schedule event IDs follow another
// calendar (e.g. F1 round numbers) and may skip weekends without a support
// race. Teams rounds use the chronological championship ordinal (1, 2, 3…)
// instead of the numeric suffix in the event ID when schedule IDs skip weekends.
var championshipOrdinalSeries = map[string]bool{
	"f3": true,
}

// eventRoundSets returns for each event ID the set of scoring rounds it
// covers. By default one round (number from ID suffix). For double-header
// series (doubleHeaderRoundSeries) consecutive events at one circuit merge into
// a group, and each event in the group covers ALL its rounds.
func eventRoundSets(sid string, events []EventJSON, season string) map[string][]int {
	out := map[string][]int{}
	if championshipOrdinalSeries[sid] {
		type ev struct {
			id    string
			idNum int
			date  string
		}
		var list []ev
		for _, e := range events {
			if season != "" && e.Season != "" && e.Season != season {
				continue
			}
			r, ok := eventRoundNumber(e.ID)
			if !ok {
				continue
			}
			list = append(list, ev{id: e.ID, idNum: r, date: strings.TrimSpace(e.StartDate)})
		}
		sort.Slice(list, func(i, j int) bool {
			di, dj := list[i].date, list[j].date
			if di != "" && dj != "" && di != dj {
				return di < dj
			}
			if di != "" && dj == "" {
				return true
			}
			if di == "" && dj != "" {
				return false
			}
			return list[i].idNum < list[j].idNum
		})
		for i, e := range list {
			out[e.id] = []int{i + 1}
		}
		return out
	}
	if !doubleHeaderRoundSeries[sid] && !eventOrdinalSeries[sid] {
		for _, e := range events {
			if season != "" && e.Season != "" && e.Season != season {
				continue
			}
			if r, ok := eventRoundNumber(e.ID); ok {
				out[e.ID] = []int{r}
			}
		}
		return out
	}
	// Group consecutive events with the same circuit into one weekend. Sort by
	// race number so grouping order does not depend on file order.
	type ev struct {
		id      string
		round   int
		circuit string
	}
	var list []ev
	for _, e := range events {
		if season != "" && e.Season != "" && e.Season != season {
			continue
		}
		if r, ok := eventRoundNumber(e.ID); ok {
			list = append(list, ev{e.ID, r, strings.TrimSpace(e.CircuitName)})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].round < list[j].round })

	type grp struct {
		rounds []int
		ids    []string
	}
	var groups []grp
	lastCircuit := ""
	for _, e := range list {
		if len(groups) > 0 && e.circuit != "" && strings.EqualFold(e.circuit, lastCircuit) {
			g := &groups[len(groups)-1]
			g.rounds = append(g.rounds, e.round)
			g.ids = append(g.ids, e.id)
		} else {
			groups = append(groups, grp{rounds: []int{e.round}, ids: []string{e.id}})
		}
		lastCircuit = e.circuit
	}
	for gi := range groups {
		g := groups[gi]
		assigned := g.rounds
		// eventOrdinalSeries: round = ordinal weekend number (1,2,3,…), not race numbers.
		if eventOrdinalSeries[sid] {
			assigned = []int{gi + 1}
		}
		for _, id := range g.ids {
			out[id] = assigned
		}
	}
	return out
}

// compressRounds turns a set of round numbers into a compact string with ranges
// via en-dash, e.g. {1,2,3,5} -> "1–3, 5".
func compressRounds(set map[int]bool) string {
	if len(set) == 0 {
		return ""
	}
	nums := make([]int, 0, len(set))
	for n := range set {
		nums = append(nums, n)
	}
	sort.Ints(nums)
	var parts []string
	start, prev := nums[0], nums[0]
	flush := func() {
		if start == prev {
			parts = append(parts, strconv.Itoa(start))
		} else {
			parts = append(parts, strconv.Itoa(start)+"–"+strconv.Itoa(prev))
		}
	}
	for i := 1; i < len(nums); i++ {
		if nums[i] == prev+1 {
			prev = nums[i]
			continue
		}
		flush()
		start, prev = nums[i], nums[i]
	}
	flush()
	return strings.Join(parts, ", ")
}

// teamsAreFlatDriver reports whether all team rows are flat (one driver, no class
// and no driver list), i.e. the table allows appending new driver rows.
func teamsAreFlatDriver(data *TeamsWithSpec) bool {
	if data == nil {
		return false
	}
	check := func(rows []TeamJSON) bool {
		for _, r := range rows {
			if strings.TrimSpace(r.Class) != "" || len(r.Drivers) > 0 {
				return false
			}
		}
		return true
	}
	return check(data.Teams) && check(data.TeamsNonChartered)
}

// entryDrivers returns the driver list from an entry_list row: driver1/2/3 first,
// else slash-separated driver ("A / B / C"), else single driver. When driver and
// driver2 are both set (Supercars weekend substitutes), both are included.
func entryDrivers(e EntryListRow) []string {
	primary := strings.TrimSpace(e.Driver)
	if primary != "" && strings.ContainsAny(primary, "/;,") && strings.TrimSpace(e.Driver1) == "" {
		return splitDriversCell(primary)
	}
	var ds []string
	seen := map[string]bool{}
	add := func(name string) {
		v := strings.TrimSpace(name)
		if v == "" {
			return
		}
		k := driverMatchKey(v)
		if k == "" || seen[k] {
			return
		}
		seen[k] = true
		ds = append(ds, v)
	}
	add(primary)
	for _, d := range []string{e.Driver1, e.Driver2, e.Driver3} {
		add(d)
	}
	return ds
}

type roundsAgg struct {
	number        string
	driver        string // single driver (for single-driver series)
	driverRound   int    // round from which the display name was taken (minimum)
	drivers       []string
	team          string
	manufacturer  string
	crewChief     string
	constructor   string
	class         string
	car           string
	powerUnit     string
	driverCountry string
	guest         bool
	rounds        map[int]bool

	// Per-driver rounds (GT/endurance): participation rounds for EACH driver on the car
	// separately, in order of first appearance.
	driverRoundsByKey map[string]*driverRoundInfo
	driverRoundsOrder []string
}

// driverRoundInfo — display name and set of participation rounds for a driver on the car.
type driverRoundInfo struct {
	display string
	rounds  map[int]bool
}

// addDriverRounds accumulates participation rounds for a specific driver on the car (by normalized
// name key), keeping the name from first appearance.
func (a *roundsAgg) addDriverRounds(display string, rounds []int) {
	key := driverMatchKey(display)
	if key == "" {
		return
	}
	if a.driverRoundsByKey == nil {
		a.driverRoundsByKey = map[string]*driverRoundInfo{}
	}
	di := a.driverRoundsByKey[key]
	if di == nil {
		di = &driverRoundInfo{display: strings.TrimSpace(display), rounds: map[int]bool{}}
		a.driverRoundsByKey[key] = di
		a.driverRoundsOrder = append(a.driverRoundsOrder, key)
	}
	for _, r := range rounds {
		di.rounds[r] = true
	}
}

func (a *roundsAgg) update(e EntryListRow, drivers []string, single string, round int) {
	a.number = strings.TrimSpace(e.Number)
	// Take the display name from the earliest round (to avoid picking up
	// a one-off tag like "(i)" that appeared on a later round).
	if single != "" && (a.driverRound == 0 || round < a.driverRound) {
		a.driver = single
		a.driverRound = round
	}
	if len(drivers) > 0 {
		a.drivers = drivers
	}
	if v := strings.TrimSpace(e.Team); v != "" {
		a.team = v
	}
	if v := strings.TrimSpace(e.Manufacturer); v != "" {
		a.manufacturer = v
	} else if v := strings.TrimSpace(e.Make); v != "" {
		a.manufacturer = v
	}
	if v := strings.TrimSpace(e.CrewChief); v != "" {
		a.crewChief = v
	}
	if v := strings.TrimSpace(e.Constructor); v != "" {
		a.constructor = v
	}
	if v := strings.TrimSpace(e.Class); v != "" {
		a.class = v
	}
	if v := strings.TrimSpace(e.Car); v != "" {
		a.car = v
	}
	if v := strings.TrimSpace(e.PowerUnit); v != "" {
		a.powerUnit = v
	}
	if v := strings.TrimSpace(e.DriverCountry); v != "" {
		a.driverCountry = v
	}
	if e.Guest {
		a.guest = true
	}
}

// EnrichTeamsRoundsFromEvents supplements/builds the teams table from entry_list of all rounds
// in the season, with per-series logic:
//   - fills rounds on curated rows (single-driver — by number+driver,
//     multi-driver/IMSA — by car number); non-destructively (does not overwrite curated values);
//   - for stock-car series merges participation BY CAR NUMBER: each driver who raced
//     the car in the season is shown as a separate row under that number with their rounds
//     (primary from curated file + substitutes/one-offs from entry_list);
//   - for GT/endurance series without a curated file (ELMS/GTWCE/Super GT/WEC) builds
//     the table from entry_list (class, car, multiple drivers, rounds);
//   - for other series without a file builds a flat table (team/number/driver/rounds).
//
// If no season round has entry_list — data is unchanged.
func EnrichTeamsRoundsFromEvents(dataDir, seriesID, season string, data *TeamsWithSpec) {
	if data == nil {
		return
	}
	events, err := LoadEvents(dataDir, seriesID)
	if err != nil || len(events) == 0 {
		return
	}
	sid := strings.ToLower(seriesID)

	// WEC: starting grid is not in entry_list but in tables.entry_list.sessions
	// (per-class table with merged car cells downward). Build from that.
	if sid == "wec" {
		if len(data.Teams) == 0 && len(data.TeamsNonChartered) == 0 {
			if built := buildWecTeamsFromEvents(dataDir, seriesID, season); len(built) > 0 {
				data.Teams = built
			}
		}
		return
	}

	byKey := map[string]*roundsAgg{} // number+normalized driver (single-driver)
	var keyOrder []string
	byNumber := map[string]*roundsAgg{} // car number (multi-driver / IMSA / GT build)
	var numOrder []string
	anyEntryList := false

	getOrCreate := func(m map[string]*roundsAgg, order *[]string, k string) *roundsAgg {
		a := m[k]
		if a == nil {
			a = &roundsAgg{rounds: map[int]bool{}}
			m[k] = a
			*order = append(*order, k)
		}
		return a
	}

	roundSets := eventRoundSets(sid, events, season)
	for _, ev := range events {
		if season != "" && ev.Season != "" && ev.Season != season {
			continue
		}
		rounds := roundSets[ev.ID]
		if len(rounds) == 0 {
			continue
		}
		minRound := rounds[0]
		for _, r := range rounds {
			if r < minRound {
				minRound = r
			}
		}
		detail, derr := LoadEventDetail(dataDir, ev.ID)
		if derr != nil || detail == nil || len(detail.EntryList) == 0 {
			continue
		}
		anyEntryList = true
		for _, e := range detail.EntryList {
			num := strings.TrimSpace(e.Number)
			drivers := entryDrivers(e)
			single := strings.TrimSpace(e.Driver)
			if single == "" && len(drivers) == 1 {
				single = drivers[0]
			}
			if substituteInsertSeries[sid] && len(drivers) > 0 {
				// One car may list multiple drivers at a round (weekend substitutes sharing
				// the entry, or separate entry_list rows with the same number).
				for _, drv := range drivers {
					drv = strings.TrimSpace(drv)
					if drv == "" {
						continue
					}
					key := num + "|" + driverMatchKey(drv)
					a := getOrCreate(byKey, &keyOrder, key)
					for _, r := range rounds {
						a.rounds[r] = true
					}
					a.update(e, []string{drv}, drv, minRound)
				}
			} else if num != "" || single != "" {
				a := getOrCreate(byKey, &keyOrder, num+"|"+driverMatchKey(single))
				for _, r := range rounds {
					a.rounds[r] = true
				}
				a.update(e, drivers, single, minRound)
			}
			if num != "" {
				b := getOrCreate(byNumber, &numOrder, num)
				for _, r := range rounds {
					b.rounds[r] = true
				}
				b.update(e, drivers, single, minRound)
				// Per-driver rounds: each driver on the car gets their own participation rounds.
				for _, dn := range drivers {
					b.addDriverRounds(dn, rounds)
				}
			}
		}
	}
	if !anyEntryList {
		return
	}

	// 1) Fill rounds on existing (curated) rows from actual participation in
	//    created rounds. If a row matched event data — OVERWRITE rounds
	//    with the computed value (need real round numbers, not placeholders like
	//    "All"/"1"/"Rolex 24"/"TBC" from the curated file). Unmatched rows are left alone.
	matched := map[string]bool{}
	fill := func(rows []TeamJSON) {
		for i := range rows {
			drv := strings.TrimSpace(rows[i].Driver)
			if drv != "" {
				dk := driverMatchKey(drv)
				if sid == "supercars" {
					// Full-time entries keep one car number; alternate livery numbers
					// (e.g. #500 at one round) merge into the curated driver's rounds.
					merged := map[int]bool{}
					for _, k := range keyOrder {
						parts := strings.SplitN(k, "|", 2)
						if len(parts) != 2 || parts[1] != dk {
							continue
						}
						if a := byKey[k]; a != nil {
							for r := range a.rounds {
								merged[r] = true
							}
							matched[k] = true
						}
					}
					if len(merged) > 0 {
						rows[i].Rounds = compressRounds(merged)
					}
					continue
				}
				key := strings.TrimSpace(rows[i].Number) + "|" + dk
				if a := byKey[key]; a != nil {
					matched[key] = true
					rows[i].Rounds = compressRounds(a.rounds)
				}
				continue // single-driver row with no match — leave unchanged
			}
			// Multi-driver row (IMSA etc.) — by car number.
			if num := strings.TrimSpace(rows[i].Number); num != "" {
				if b := byNumber[num]; b != nil {
					rows[i].Rounds = compressRounds(b.rounds)
				}
			}
		}
	}
	fill(data.Teams)
	fill(data.TeamsNonChartered)

	hasCurated := len(data.Teams) > 0 || len(data.TeamsNonChartered) > 0
	if hasCurated {
		// Insert substitute/one-off drivers next to their car (by number),
		// so the frontend groups them under that car.
		if substituteInsertSeries[sid] && teamsAreFlatDriver(data) {
			insertSubstituteDrivers(data, byKey, keyOrder, matched)
		}
		// Hide placeholders (TBA/TBC) and rows without participation data for series where
		// required (stock-car and IMSA): Teams table shows only those who
		// were actually entered/raced.
		if dropPlaceholderSeries[sid] {
			data.Teams = dropPlaceholderRows(data.Teams)
			data.TeamsNonChartered = dropPlaceholderRows(data.TeamsNonChartered)
		}
		return
	}

	// 2) No curated file — build the table from entry_list.
	if gtMultiDriverSeries[sid] {
		data.Teams = buildGtTeams(byNumber, numOrder)
		return
	}
	data.Teams = buildFlatTeams(byKey, keyOrder)
}

// insertSubstituteDrivers adds drivers who raced the car but did not match a curated row
// (substitutes/one-offs). Each is inserted right after the block of rows with the same
// number (inheriting car descriptive fields and full_time) so the frontend groups them
// under that car. Entirely new numbers are appended at the end.
func insertSubstituteDrivers(data *TeamsWithSpec, byKey map[string]*roundsAgg, keyOrder []string, matched map[string]bool) {
	var leftovers []TeamJSON
	for _, key := range keyOrder {
		if matched[key] {
			continue
		}
		a := byKey[key]
		if a.number == "" || a.driver == "" {
			continue
		}
		sub := TeamJSON{
			Manufacturer:  a.manufacturer,
			Team:          a.team,
			Number:        a.number,
			Driver:        a.driver,
			CrewChief:     a.crewChief,
			Car:           a.car,
			PowerUnit:     a.powerUnit,
			Class:         a.class,
			DriverCountry: a.driverCountry,
			Rounds:        compressRounds(a.rounds),
			FullTime:      false,
		}
		// 1) Known car number — group under that car.
		if insertAfterNumber(&data.Teams, sub) {
			continue
		}
		if insertAfterNumber(&data.TeamsNonChartered, sub) {
			continue
		}
		// 2) New number but team already exists — append to that team's block.
		if insertAfterTeam(&data.Teams, sub) {
			continue
		}
		if insertAfterTeam(&data.TeamsNonChartered, sub) {
			continue
		}
		// 3) Team also missing — entirely new entry.
		leftovers = append(leftovers, sub)
	}
	// Entirely new teams (number and team unseen) go to the end of chartered,
	// sorted by team and number for stability.
	if len(leftovers) > 0 {
		sort.SliceStable(leftovers, func(i, j int) bool {
			if leftovers[i].Team != leftovers[j].Team {
				return leftovers[i].Team < leftovers[j].Team
			}
			return numberLess(leftovers[i].Number, leftovers[j].Number)
		})
		data.Teams = append(data.Teams, leftovers...)
	}
}

// insertAfterNumber inserts sub right after the last row with the same car number,
// inheriting missing fields and full_time from the matched row. Returns false
// if the number is not found in the slice.
func insertAfterNumber(rows *[]TeamJSON, sub TeamJSON) bool {
	last := -1
	var matchRow TeamJSON
	for i, r := range *rows {
		if strings.TrimSpace(r.Number) == strings.TrimSpace(sub.Number) {
			last = i
			matchRow = r
		}
	}
	if last < 0 {
		return false
	}
	// A substitute drives the SAME car, so car descriptive fields (team,
	// manufacturer, crew chief, chassis, engine, class) are taken CANONICALLY from the matched row —
	// overwriting possible entry_list mismatches (e.g. team name hyphen/dash spelling)
	// so the driver is guaranteed to group under that car.
	// FullTime is left as set by the caller (substitutes stay part-time).
	if matchRow.Team != "" {
		sub.Team = matchRow.Team
	}
	if matchRow.Manufacturer != "" {
		sub.Manufacturer = matchRow.Manufacturer
	}
	if matchRow.CrewChief != "" {
		sub.CrewChief = matchRow.CrewChief
	}
	if matchRow.Car != "" {
		sub.Car = matchRow.Car
	}
	if matchRow.PowerUnit != "" {
		sub.PowerUnit = matchRow.PowerUnit
	}
	if matchRow.Chassis != "" {
		sub.Chassis = matchRow.Chassis
	}
	if matchRow.Class != "" {
		sub.Class = matchRow.Class
	}
	s := *rows
	s = append(s, TeamJSON{})
	copy(s[last+2:], s[last+1:])
	s[last+1] = sub
	*rows = s
	return true
}

// insertAfterTeam inserts a new car (new number) right after the last row of the same
// team so the entry lands in that team's block. full_time is NOT inherited
// (new number — usually a one-off/wildcard entry). Returns false if the team is missing.
func insertAfterTeam(rows *[]TeamJSON, sub TeamJSON) bool {
	team := strings.TrimSpace(sub.Team)
	if team == "" {
		return false
	}
	last := -1
	for i, r := range *rows {
		if strings.EqualFold(strings.TrimSpace(r.Team), team) {
			last = i
		}
	}
	if last < 0 {
		return false
	}
	s := *rows
	s = append(s, TeamJSON{})
	copy(s[last+2:], s[last+1:])
	s[last+1] = sub
	*rows = s
	return true
}

func buildGtTeams(byNumber map[string]*roundsAgg, numOrder []string) []TeamJSON {
	out := make([]TeamJSON, 0, len(numOrder))
	for _, num := range numOrder {
		a := byNumber[num]
		drivers, driverRounds := a.drivers, []string(nil)
		// When per-driver data exists — build driver list and their rounds in sync,
		// in first-appearance order (not "last round's lineup").
		if len(a.driverRoundsOrder) > 0 {
			drivers = make([]string, 0, len(a.driverRoundsOrder))
			driverRounds = make([]string, 0, len(a.driverRoundsOrder))
			for _, k := range a.driverRoundsOrder {
				di := a.driverRoundsByKey[k]
				drivers = append(drivers, di.display)
				driverRounds = append(driverRounds, compressRounds(di.rounds))
			}
		}
		out = append(out, TeamJSON{
			Class:        a.class,
			Number:       a.number,
			Team:         a.team,
			Car:          a.car,
			Manufacturer: a.manufacturer,
			Drivers:      drivers,
			DriverRounds: driverRounds,
			Rounds:       compressRounds(a.rounds),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		ci, cj := classOrderIndex(out[i].Class), classOrderIndex(out[j].Class)
		if ci != cj {
			return ci < cj
		}
		if out[i].Class != out[j].Class {
			return out[i].Class < out[j].Class
		}
		return numberLess(out[i].Number, out[j].Number)
	})
	return out
}

func buildFlatTeams(byKey map[string]*roundsAgg, keyOrder []string) []TeamJSON {
	out := make([]TeamJSON, 0, len(keyOrder))
	for _, key := range keyOrder {
		a := byKey[key]
		if a.number == "" && a.driver == "" {
			continue
		}
		out = append(out, TeamJSON{
			Number:        a.number,
			Driver:        a.driver,
			Team:          a.team,
			Manufacturer:  a.manufacturer,
			CrewChief:     a.crewChief,
			Class:         a.class,
			Car:           a.car,
			DriverCountry: a.driverCountry,
			Guest:         a.guest,
			Rounds:        compressRounds(a.rounds),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Team != out[j].Team {
			return out[i].Team < out[j].Team
		}
		return numberLess(out[i].Number, out[j].Number)
	})
	return out
}

func classOrderIndex(class string) int {
	c := strings.ToUpper(strings.TrimSpace(class))
	for i, name := range gtClassOrder {
		if name == c {
			return i
		}
	}
	return len(gtClassOrder)
}

// wecGridRoot is a minimal WEC event projection for reading the starting grid from
// tables.entry_list.sessions (one session table per class).
type wecGridRoot struct {
	Tables struct {
		EntryList struct {
			Sessions []struct {
				Title   string  `json:"title"`
				Headers []any   `json:"headers"`
				Rows    [][]any `json:"rows"`
			} `json:"sessions"`
		} `json:"entry_list"`
	} `json:"tables"`
}

func anyToStr(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return strings.TrimSpace(fmt.Sprintf("%v", v))
}

func cellStr(row []any, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return anyToStr(row[i])
}

// buildWecTeamsFromEvents builds WEC teams from tables.entry_list.sessions of all season
// rounds: one row per car (by number), with class, team, model, driver lineup
// (from the last round) and rounds = rounds where the car was present.
func buildWecTeamsFromEvents(dataDir, seriesID, season string) []TeamJSON {
	events, err := LoadEvents(dataDir, seriesID)
	if err != nil || len(events) == 0 {
		return nil
	}
	type evRound struct {
		id    string
		round int
	}
	var evs []evRound
	for _, e := range events {
		if season != "" && e.Season != "" && e.Season != season {
			continue
		}
		if r, ok := eventRoundNumber(e.ID); ok {
			evs = append(evs, evRound{e.ID, r})
		}
	}
	sort.Slice(evs, func(i, j int) bool { return evs[i].round < evs[j].round })

	byNumber := map[string]*roundsAgg{}
	var order []string

	for _, e := range evs {
		raw, rerr := readEventDetailFile(dataDir, strings.ToLower(e.id))
		if rerr != nil || raw == nil {
			continue
		}
		var root wecGridRoot
		if json.Unmarshal(raw, &root) != nil {
			continue
		}
		for _, s := range root.Tables.EntryList.Sessions {
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
			class := strings.TrimSpace(s.Title)
			var curNum, curTeam, curCar string // carry merged cells downward
			lineup := map[string][]string{}    // lineup at this round (last wins)
			for _, row := range s.Rows {
				if t := cellStr(row, entrantI); t != "" {
					curTeam = t
				}
				if c := cellStr(row, carI); c != "" {
					curCar = c
				}
				no := cellStr(row, noI)
				if no != "" {
					curNum = no
					a := byNumber[curNum]
					if a == nil {
						a = &roundsAgg{rounds: map[int]bool{}}
						byNumber[curNum] = a
						order = append(order, curNum)
					}
					a.number = curNum
					a.class = class
					if curTeam != "" {
						a.team = curTeam
					}
					if curCar != "" {
						a.car = curCar
					}
					a.rounds[e.round] = true
					lineup[curNum] = nil
				}
				if curNum == "" {
					continue
				}
				if d := cellStr(row, drvI); d != "" {
					lineup[curNum] = append(lineup[curNum], d)
					if a := byNumber[curNum]; a != nil {
						a.addDriverRounds(d, []int{e.round})
					}
				}
			}
			for num, ds := range lineup {
				if a := byNumber[num]; a != nil && len(ds) > 0 {
					a.drivers = ds
				}
			}
		}
	}
	return buildGtTeams(byNumber, order)
}

// numberLess compares car numbers numerically, then lexicographically (for "06" etc.).
func numberLess(a, b string) bool {
	na, ea := strconv.Atoi(strings.TrimSpace(a))
	nb, eb := strconv.Atoi(strings.TrimSpace(b))
	if ea == nil && eb == nil {
		if na != nb {
			return na < nb
		}
		return a < b
	}
	return a < b
}
