// Package eventscaffold creates empty event JSON skeletons from schedule files at server startup.
package eventscaffold

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

const lastResultsDays = 7

// Mode selects which schedule events are considered for scaffolding.
type Mode int

const (
	// ModeLastResults scaffolds past events still in the Last Results window.
	ModeLastResults Mode = iota
	// ModeMissing scaffolds all current-season events without a detail file.
	ModeMissing
	// ModeUpcoming scaffolds future events within the upcoming window.
	ModeUpcoming
)

const upcomingDays = 14

// Options controls scaffold behavior.
type Options struct {
	Mode          Mode
	Season        string
	WithEntryList bool
	Force         bool
	EventIDs      []string
}

type seriesMeta struct {
	series   string
	template string
}

var seriesMetaByDataID = map[string]seriesMeta{
	"nascar_cup":     {series: "NASCAR Cup Series", template: "stockcar"},
	"noaps":          {series: "NASCAR O'Reilly Auto Parts Series", template: "stockcar"},
	"nascar_truck":   {series: "NASCAR Craftsman Truck Series", template: "stockcar"},
	"nascar_modified": {series: "NASCAR Whelen Modified Tour", template: "stockcar"},
	"arca":           {series: "ARCA Menards Series", template: "stockcar_arca"},
	"f1":             {series: "Formula 1", template: "f1"},
	"f2":             {series: "FIA Formula 2 Championship", template: "f2f3"},
	"f3":             {series: "FIA Formula 3 Championship", template: "f2f3"},
	"frec":           {series: "FIA Formula Regional European Championship", template: "frec"},
	"f4_it":          {series: "Italian F4 Championship", template: "frec"},
	"indycar":        {series: "IndyCar Series", template: "indycar"},
	"wec":            {series: "FIA World Endurance Championship", template: "endurance"},
	"elms":           {series: "European Le Mans Series", template: "endurance"},
	"imsa":           {series: "IMSA WeatherTech SportsCar Championship", template: "endurance"},
	"gtwce_end":      {series: "GT World Challenge Europe Endurance", template: "endurance"},
	"gtwce_sprint":   {series: "GT World Challenge Europe Sprint", template: "gt_sprint"},
	"supercars":      {series: "Supercars Championship", template: "generic"},
	"dtm":            {series: "DTM", template: "generic"},
	"super_gt":       {series: "Super GT", template: "generic"},
	"super_formula":  {series: "Super Formula", template: "generic"},
	"psc":            {series: "Porsche Supercup", template: "generic"},
}

var (
	isoDateRe           = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	eventRoundRe        = regexp.MustCompile(`^(.+)_(20\d{2})_(\d+)$`)
	nascarCup0Re        = regexp.MustCompile(`(?i)^NASCAR_CUP_.*_0$`)
	weekendRaceSuffixRe = regexp.MustCompile(`(?i)\s+Race\s+\d+\s*$`)
)

type scheduledEvent struct {
	dataID string
	ev     schedulefile.EventJSON
}

type skeletonBody struct {
	EventID    string                           `json:"event_id"`
	Series     string                           `json:"series,omitempty"`
	Race       string                           `json:"race,omitempty"`
	Date       string                           `json:"date,omitempty"`
	StartDate  string                           `json:"start_date,omitempty"`
	EndDate    string                           `json:"end_date,omitempty"`
	Track      string                           `json:"track,omitempty"`
	Location   string                           `json:"location,omitempty"`
	Laps       string                           `json:"laps,omitempty"`
	Distance   string                           `json:"distance,omitempty"`
	Stage1Laps string                           `json:"stage1_laps,omitempty"`
	Stage2Laps string                           `json:"stage2_laps,omitempty"`
	Stage3Laps string                           `json:"stage3_laps,omitempty"`
	EntryList  []schedulefile.EntryListRow      `json:"entry_list"`
	Tables     map[string]schedulefile.EventTable `json:"tables"`
}

// RunAtStartup creates last-results skeletons once when the server starts.
func RunAtStartup(dataDir string) {
	n, err := Run(dataDir, Options{
		Mode:   ModeLastResults,
		Season: config.CurrentSeason,
	})
	if err != nil {
		slog.Warn("event scaffold failed", "err", err)
		return
	}
	if n > 0 {
		slog.Info("event skeletons created", "count", n)
	}
}

// Run creates event skeleton files according to opts. Returns the number of files written.
func Run(dataDir string, opts Options) (int, error) {
	if opts.Season == "" {
		opts.Season = config.CurrentSeason
	}
	today := time.Now().Format("2006-01-02")
	scheduled, err := loadAllScheduleEvents(dataDir, opts.Season)
	if err != nil {
		return 0, err
	}

	filter := make(map[string]struct{}, len(opts.EventIDs))
	for _, id := range opts.EventIDs {
		filter[strings.ToUpper(strings.TrimSpace(id))] = struct{}{}
	}

	groups := groupAllScheduleByDetailID(dataDir, scheduled)
	seenDetail := make(map[string]bool)
	created := 0
	for _, item := range scheduled {
		if !shouldScaffold(item.ev, opts, filter, today) {
			continue
		}

		detailID := schedulefile.ResolveEventDetailID(dataDir, item.ev.ID)
		if seenDetail[detailID] {
			continue
		}
		seenDetail[detailID] = true

		group := groups[detailID]
		if len(group) == 0 {
			group = []scheduledEvent{item}
		}

		exists := schedulefile.EventDetailExists(dataDir, detailID)
		var existing *schedulefile.EventDetailJSON
		if exists {
			existing, err = schedulefile.LoadEventDetail(dataDir, detailID)
			if err != nil {
				return created, fmt.Errorf("load %s: %w", detailID, err)
			}
			if !isSkeleton(existing) {
				continue
			}
			if !opts.Force {
				continue
			}
		}

		entryList := []schedulefile.EntryListRow{}
		if opts.WithEntryList {
			entryList = previousRoundEntryList(dataDir, group[0].ev.ID)
		}
		body := buildSkeletonFromGroup(group, detailID, entryList)
		if err := schedulefile.SaveEventDetailAtPreferredPath(dataDir, detailID, body); err != nil {
			return created, fmt.Errorf("write %s: %w", detailID, err)
		}
		rel, _ := filepath.Rel(dataDir, schedulefile.PreferredEventDetailPath(dataDir, detailID))
		if exists {
			slog.Info("event skeleton updated", "path", rel, "event_id", strings.ToUpper(detailID))
		} else {
			slog.Info("event skeleton created", "path", rel, "event_id", strings.ToUpper(detailID))
		}
		created++
	}
	return created, nil
}

func groupAllScheduleByDetailID(dataDir string, scheduled []scheduledEvent) map[string][]scheduledEvent {
	groups := make(map[string][]scheduledEvent)
	for _, item := range scheduled {
		detailID := schedulefile.ResolveEventDetailID(dataDir, item.ev.ID)
		groups[detailID] = append(groups[detailID], item)
	}
	for detailID := range groups {
		sortScheduledEvents(groups[detailID])
	}
	return groups
}

func sortScheduledEvents(items []scheduledEvent) {
	sort.Slice(items, func(i, j int) bool {
		si, sj := eventDateStart(items[i].ev), eventDateStart(items[j].ev)
		if si != "" && sj != "" && si != sj {
			return si < sj
		}
		return strings.ToUpper(items[i].ev.ID) < strings.ToUpper(items[j].ev.ID)
	})
}

func loadAllScheduleEvents(dataDir, season string) ([]scheduledEvent, error) {
	schedDir := filepath.Join(dataDir, "schedules")
	entries, err := os.ReadDir(schedDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var out []scheduledEvent
	for _, ent := range entries {
		if ent.IsDir() || !strings.HasSuffix(strings.ToLower(ent.Name()), ".json") {
			continue
		}
		dataID := strings.TrimSuffix(ent.Name(), filepath.Ext(ent.Name()))
		b, err := os.ReadFile(filepath.Join(schedDir, ent.Name())) //nolint:gosec
		if err != nil {
			continue
		}
		var list []schedulefile.EventJSON
		if err := json.Unmarshal(b, &list); err != nil {
			continue
		}
		for _, ev := range list {
			if strings.TrimSpace(ev.ID) == "" {
				continue
			}
			evSeason := strings.TrimSpace(ev.Season)
			if evSeason == "" {
				evSeason = season
			}
			if evSeason != season {
				continue
			}
			out = append(out, scheduledEvent{dataID: dataID, ev: ev})
		}
	}
	return out, nil
}

func shouldScaffold(ev schedulefile.EventJSON, opts Options, filter map[string]struct{}, today string) bool {
	idU := strings.ToUpper(strings.TrimSpace(ev.ID))
	if strings.Contains(idU, "PROLOGUE") || strings.Contains(idU, "PRE_SEASON") {
		return false
	}
	if nascarCup0Re.MatchString(idU) {
		return false
	}
	if len(filter) > 0 {
		_, ok := filter[idU]
		return ok
	}

	start := eventDateStart(ev)
	end := eventDateEnd(ev, start)

	switch opts.Mode {
	case ModeMissing:
		return true
	case ModeUpcoming:
		if !isISO(start) || start < today {
			return false
		}
		return start <= addDaysISO(today, upcomingDays)
	case ModeLastResults:
		fallthrough
	default:
		if !isPastForLastResults(start, end, today) {
			return false
		}
		return isWithinLastResultsWindow(end, today)
	}
}

func isSkeleton(d *schedulefile.EventDetailJSON) bool {
	if d == nil {
		return true
	}
	tables := d.Tables
	if len(tables) == 0 {
		return true
	}
	if rr, ok := tables["race_results"]; ok && len(rr.Rows) > 0 {
		return false
	}
	if race, ok := tables["race"]; ok {
		for _, s := range race.Sessions {
			if len(s.Rows) > 0 {
				return false
			}
		}
	}
	if sprint, ok := tables["sprint"]; ok && len(sprint.Rows) > 0 {
		return false
	}
	if feature, ok := tables["feature"]; ok && len(feature.Rows) > 0 {
		return false
	}
	return true
}

func previousRoundEntryList(dataDir, eventID string) []schedulefile.EntryListRow {
	idU := strings.ToUpper(strings.TrimSpace(eventID))
	m := eventRoundRe.FindStringSubmatch(idU)
	if len(m) < 4 {
		return nil
	}
	prefix, year := m[1], m[2]
	var round int
	if _, err := fmt.Sscanf(m[3], "%d", &round); err != nil {
		return nil
	}
	for r := round - 1; r >= 0; r-- {
		prevID := fmt.Sprintf("%s_%s_%d", prefix, year, r)
		detail, err := schedulefile.LoadEventDetail(dataDir, prevID)
		if err != nil || detail == nil || len(detail.EntryList) == 0 {
			continue
		}
		out := make([]schedulefile.EntryListRow, len(detail.EntryList))
		copy(out, detail.EntryList)
		return out
	}
	return nil
}

func buildSkeletonFromGroup(group []scheduledEvent, detailID string, entryList []schedulefile.EntryListRow) skeletonBody {
	sortScheduledEvents(group)
	primary := group[0]
	meta := seriesMetaByDataID[primary.dataID]
	if meta.series == "" {
		meta.series = strings.TrimSpace(primary.ev.SeriesID)
		if meta.series == "" {
			meta.series = primary.dataID
		}
		meta.template = "generic"
	}

	start := ""
	end := ""
	for _, item := range group {
		s := eventDateStart(item.ev)
		e := eventDateEnd(item.ev, s)
		if isISO(s) && (start == "" || s < start) {
			start = s
		}
		if isISO(e) && (end == "" || e > end) {
			end = e
		}
	}
	if end == "" {
		end = start
	}

	body := skeletonBody{
		EventID:   strings.ToUpper(strings.TrimSpace(detailID)),
		Series:    meta.series,
		Race:      raceTitle(primary.ev.Name),
		Date:      formatDisplayDate(start, end, start != "" && end != "" && start != end),
		StartDate: start,
		EndDate:   end,
		Track:     shortTrack(primary.ev.CircuitName, primary.ev.Location),
		Location:  shortLocation(primary.ev.Location, primary.ev.CircuitName),
		EntryList: entryList,
		Tables:    buildTables(meta.template),
	}
	if meta.template == "stockcar" {
		body.Stage1Laps = ""
		body.Stage2Laps = ""
		body.Stage3Laps = ""
	}
	return body
}

func eventDateStart(ev schedulefile.EventJSON) string {
	if s := strings.TrimSpace(ev.StartDate); isISO(s) {
		return s
	}
	return ""
}

func eventDateEnd(ev schedulefile.EventJSON, start string) string {
	if s := strings.TrimSpace(ev.EndDate); isISO(s) {
		return s
	}
	return start
}

func isISO(s string) bool {
	return isoDateRe.MatchString(s)
}

func addDaysISO(iso string, days int) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	return t.AddDate(0, 0, days).Format("2006-01-02")
}

func isPastForLastResults(start, end, today string) bool {
	if !isISO(end) {
		return false
	}
	if isISO(start) && start > today {
		return false
	}
	if end < today {
		return true
	}
	return end <= today
}

func isWithinLastResultsWindow(end, today string) bool {
	if !isISO(end) {
		return false
	}
	return today <= addDaysISO(end, lastResultsDays)
}

func formatDisplayDate(start, end string, multiDay bool) string {
	if !isISO(start) {
		return ""
	}
	st, err := time.Parse("2006-01-02", start)
	if err != nil {
		return ""
	}
	months := []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
	days := []string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}
	if multiDay && isISO(end) {
		en, err := time.Parse("2006-01-02", end)
		if err == nil {
			return fmt.Sprintf("%d–%d %s %d", st.Day(), en.Day(), months[en.Month()-1], en.Year())
		}
	}
	return fmt.Sprintf("%s, %s %d, %d", days[st.Weekday()], months[st.Month()-1], st.Day(), st.Year())
}

func shortTrack(circuitName, location string) string {
	c := strings.TrimSpace(circuitName)
	if c == "" {
		c = strings.TrimSpace(location)
	}
	if c == "" {
		return "—"
	}
	if idx := strings.Index(c, ", "); idx >= 0 {
		return c[:idx]
	}
	return c
}

func shortLocation(location, circuitName string) string {
	if loc := strings.TrimSpace(location); loc != "" {
		return loc
	}
	c := strings.TrimSpace(circuitName)
	if idx := strings.Index(c, ", "); idx >= 0 {
		return c[idx+2:]
	}
	if c != "" {
		return c
	}
	return "—"
}

func raceTitle(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "—"
	}
	name = weekendRaceSuffixRe.ReplaceAllString(name, "")
	name = regexp.MustCompile(`(?i)\s*\([^)]*rescheduled[^)]*\)\s*`).ReplaceAllString(name, "")
	name = strings.TrimSpace(name)
	if name == "" {
		return "—"
	}
	for _, prefix := range []string{"Italian F4 — ", "Italian F4 - "} {
		if strings.HasPrefix(name, prefix) {
			if t := strings.TrimSpace(strings.TrimPrefix(name, prefix)); t != "" {
				return t
			}
		}
	}
	if strings.HasPrefix(strings.ToLower(name), "italian f4") {
		for _, sep := range []string{" — ", " - "} {
			if idx := strings.Index(name, sep); idx >= 0 {
				if t := strings.TrimSpace(name[idx+len(sep):]); t != "" {
					return t
				}
			}
		}
	}
	return name
}

func emptyTable(headers []string, title string) schedulefile.EventTable {
	t := schedulefile.EventTable{Headers: headers, Rows: [][]string{}}
	if title != "" {
		t.Title = title
	}
	return t
}

func buildTables(template string) map[string]schedulefile.EventTable {
	switch template {
	case "stockcar":
		return map[string]schedulefile.EventTable{
			"practice":     emptyTable(stockcarPracticeHeaders, ""),
			"qualifying":   emptyTable(stockcarQualHeaders, ""),
			"stage_1":      emptyTable(stockcarStageHeaders, "Stage 1"),
			"stage_2":      emptyTable(stockcarStageHeaders, "Stage 2"),
			"race_results": emptyTable(stockcarRaceHeaders, ""),
		}
	case "stockcar_arca":
		return map[string]schedulefile.EventTable{
			"practice":     emptyTable(stockcarPracticeHeaders, ""),
			"qualifying":   emptyTable(stockcarQualHeaders, ""),
			"race_results": emptyTable(stockcarRaceHeaders, ""),
		}
	case "f1":
		return map[string]schedulefile.EventTable{
			"practice": {
				Sessions: []schedulefile.EventTableSession{
					{Title: "Practice 1", Headers: f2f3PracticeHeaders, Rows: [][]string{}},
					{Title: "Practice 2", Headers: f2f3PracticeHeaders, Rows: [][]string{}},
					{Title: "Practice 3", Headers: f2f3PracticeHeaders, Rows: [][]string{}},
				},
			},
			"qualifying": {
				Sessions: []schedulefile.EventTableSession{
					{Title: "Qualifying", Headers: f2f3QualHeaders, Rows: [][]string{}},
				},
			},
			"race_results": emptyTable(f2f3RaceHeaders, ""),
		}
	case "f2f3":
		return map[string]schedulefile.EventTable{
			"practice":   emptyTable(f2f3PracticeHeaders, ""),
			"qualifying": emptyTable(f2f3QualHeaders, ""),
			"sprint":     emptyTable(f2f3RaceHeaders, "Sprint Race Results"),
			"feature":    emptyTable(f2f3RaceHeaders, "Feature Race Results"),
		}
	case "frec":
		return map[string]schedulefile.EventTable{
			"practice":   emptyTable(frecPracticeHeaders, ""),
			"qualifying": emptyTable(frecQualHeaders, ""),
			"race": {
				Sessions: []schedulefile.EventTableSession{
					{Title: "Race 1", Headers: frecRaceHeaders, Rows: [][]string{}},
					{Title: "Race 2", Headers: frecRaceHeaders, Rows: [][]string{}},
					{Title: "Race 3", Headers: frecRaceHeaders, Rows: [][]string{}},
				},
			},
		}
	case "indycar":
		return map[string]schedulefile.EventTable{
			"practice":            emptyTable(indycarPracticeHeaders, "Practice 1"),
			"practice2":           emptyTable(indycarPracticeHeaders, "Practice 2"),
			"final_practice":      emptyTable(indycarPracticeHeaders, "Final Practice"),
			"qualifying":          emptyTable(indycarQualHeaders, "Qualifying"),
			"race_results":        emptyTable(indycarRaceHeaders, ""),
			"caution_breakdown":   emptyTable([]string{"Condition", "From Lap", "To Lap", "# Of Laps", "Reason"}, ""),
		}
	default:
		return map[string]schedulefile.EventTable{
			"practice":     emptyTable([]string{"Pos", "Driver", "Team", "Time"}, ""),
			"qualifying":   emptyTable([]string{"Pos", "Driver", "Team", "Time"}, ""),
			"race_results": emptyTable([]string{"Pos", "Driver", "Team", "Time/Retired"}, ""),
		}
	}
}

var (
	stockcarPracticeHeaders = []string{"Pos", "Trk", "Driver", "Team", "Make", "Time", "Speed", "Lap #", "# Laps", "-Fastest", "-Next"}
	stockcarQualHeaders     = []string{"Pos", "#", "Driver", "Team", "Make", "Time", "Speed"}
	stockcarStageHeaders    = []string{"Pos", "#", "Driver", "Team", "Make", "Pts"}
	stockcarRaceHeaders     = []string{"Fin", "St", "#", "Driver", "Team", "Make", "Laps", "Led", "Status", "Pts"}
	f2f3PracticeHeaders     = []string{"Pos", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH"}
	f2f3QualHeaders         = []string{"Pos", "No.", "Driver", "Team", "Time", "Gap", "Int", "KPH"}
	f2f3RaceHeaders         = []string{"Pos", "No.", "Driver", "Team", "Laps", "Time/Retired", "Grid", "Pts"}
	frecPracticeHeaders     = []string{"Pos", "No.", "Driver", "Team", "Laps", "Time", "Gap", "Int", "KPH"}
	frecQualHeaders         = []string{"Pos", "No.", "Driver", "Team", "Time", "Gap", "Int", "KPH"}
	frecRaceHeaders         = []string{"Fin / ST", "No.", "Driver", "Team", "Laps", "Time/Retired", "Pts"}
	indycarPracticeHeaders  = []string{"Rank", "Car", "Driver Name", "C/E/T", "Time", "Speed", "Diff", "Gap", "Best Lap", "Laps"}
	indycarQualHeaders      = []string{"Pos", "Car", "Driver Name", "C/E/T", "Time", "Speed"}
	indycarRaceHeaders      = []string{"Pos", "St", "No", "Driver", "Team", "Engine", "Laps", "Time/Retired", "Led", "Pts"}
)
