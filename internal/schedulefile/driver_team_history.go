package schedulefile

import (
	"sort"
	"strconv"
	"strings"

	"github.com/vX8q/tga/models"
)

type teamYearAgg struct {
	starts    int
	nameVotes map[string]int
	carVotes  map[string]int
}

type teamHistoryGroup struct {
	seriesID   string
	seriesName string
	byYear     map[int]*teamYearAgg
}

// BuildDriverTeamHistory groups a driver's results into team stints.
// Consecutive seasons with the same team become one interval (2024–2026);
// a gap year or a different team starts a new stint.
func BuildDriverTeamHistory(results []models.DriverSeasonResult) []models.DriverTeamStint {
	if len(results) == 0 {
		return []models.DriverTeamStint{}
	}

	groups := map[string]*teamHistoryGroup{}
	for _, r := range results {
		team := strings.TrimSpace(r.TeamName)
		if team == "" || team == "—" {
			continue
		}
		year, ok := parseTeamHistoryYear(r.Season)
		if !ok {
			continue
		}
		seriesID := strings.TrimSpace(r.SeriesID)
		if seriesID == "" {
			continue
		}
		key := teamHistoryGroupKey(seriesID, team)
		g := groups[key]
		if g == nil {
			g = &teamHistoryGroup{
				seriesID:   seriesID,
				seriesName: strings.TrimSpace(r.SeriesName),
				byYear:     map[int]*teamYearAgg{},
			}
			if g.seriesName == "" {
				g.seriesName = seriesDisplayName(seriesID)
			}
			groups[key] = g
		}
		agg := g.byYear[year]
		if agg == nil {
			agg = &teamYearAgg{
				nameVotes: map[string]int{},
				carVotes:  map[string]int{},
			}
			g.byYear[year] = agg
		}
		agg.nameVotes[team]++
		if car := strings.TrimSpace(r.CarNumber); car != "" && car != "—" {
			agg.carVotes[car]++
		}
		if !driverResultIsEntryList(r) {
			agg.starts++
		}
	}

	out := make([]models.DriverTeamStint, 0, len(groups))
	for _, g := range groups {
		out = append(out, collapseTeamStints(g)...)
	}
	sortTeamStints(out)
	return out
}

func driverResultIsEntryList(r models.DriverSeasonResult) bool {
	return strings.EqualFold(strings.TrimSpace(r.Status), "Entry list") ||
		strings.EqualFold(strings.TrimSpace(r.RaceName), "Entry list")
}

func parseTeamHistoryYear(season string) (int, bool) {
	n, err := strconv.Atoi(strings.TrimSpace(season))
	if err != nil || n < 1900 || n > 2100 {
		return 0, false
	}
	return n, true
}

func teamHistoryGroupKey(seriesID, teamName string) string {
	series := strings.ToUpper(strings.TrimSpace(seriesID))
	switch series {
	case "F1":
		return series + "\n" + strings.ToLower(f1TeamCoreName(teamName))
	case "NASCAR_CUP", "NOAPS", "NASCAR_TRUCK", "ARCA", "NASCAR_MODIFIED":
		return series + "\n" + foldStockCarTeamKey(teamName)
	default:
		return series + "\n" + strings.ToLower(strings.Join(strings.Fields(teamName), " "))
	}
}

func f1TeamCoreName(name string) string {
	s := strings.TrimSpace(name)
	s = stripF1PowerUnit(s)
	s = foldF1TeamAlias(s)
	s = canonicalizeF1Constructor(s)
	return stripF1PowerUnit(s)
}

// foldF1TeamAlias maps commercial / entry-list names onto a constructor core
// so "Scuderia Ferrari HP" and "Ferrari-Ferrari" collapse to one stint.
func foldF1TeamAlias(name string) string {
	lower := strings.ToLower(strings.TrimSpace(name))
	switch {
	case strings.Contains(lower, "ferrari"):
		return "Ferrari"
	case strings.Contains(lower, "alpine"):
		return "Alpine"
	case strings.Contains(lower, "mercedes"):
		return "Mercedes"
	case strings.Contains(lower, "mclaren"):
		return "McLaren"
	case strings.Contains(lower, "racing bull") || strings.Contains(lower, "visa cash app") || lower == "rb":
		return "Racing Bulls"
	case strings.Contains(lower, "red bull"):
		return "Red Bull Racing"
	case strings.Contains(lower, "williams"):
		return "Williams"
	case strings.Contains(lower, "aston martin"):
		return "Aston Martin"
	case strings.Contains(lower, "haas"):
		return "Haas"
	case strings.Contains(lower, "sauber"):
		return "Kick Sauber"
	case strings.Contains(lower, "audi"):
		return "Audi"
	case strings.Contains(lower, "cadillac"):
		return "Cadillac"
	default:
		return strings.TrimSpace(name)
	}
}

func stripF1PowerUnit(name string) string {
	s := strings.TrimSpace(name)
	lower := strings.ToLower(s)
	suffixes := []string{
		"-honda rbpt",
		"-red bull ford",
		"-red bull powertrains",
		"-mercedes",
		"-ferrari",
		"-renault",
		"-ford",
	}
	for _, suf := range suffixes {
		if strings.HasSuffix(lower, suf) {
			return strings.TrimSpace(s[:len(s)-len(suf)])
		}
	}
	return s
}

func collapseTeamStints(g *teamHistoryGroup) []models.DriverTeamStint {
	if g == nil || len(g.byYear) == 0 {
		return nil
	}
	years := make([]int, 0, len(g.byYear))
	for y := range g.byYear {
		years = append(years, y)
	}
	sortInts(years)

	var out []models.DriverTeamStint
	i := 0
	for i < len(years) {
		from := years[i]
		to := from
		starts := g.byYear[from].starts
		nameVotes := copyIntMap(g.byYear[from].nameVotes)
		carVotes := copyIntMap(g.byYear[from].carVotes)
		j := i + 1
		for j < len(years) && years[j] == to+1 {
			to = years[j]
			yr := g.byYear[to]
			starts += yr.starts
			addIntMap(nameVotes, yr.nameVotes)
			addIntMap(carVotes, yr.carVotes)
			j++
		}
		teamName := pickVoteWinner(nameVotes)
		if strings.EqualFold(g.seriesID, "F1") {
			if core := f1TeamCoreName(teamName); core != "" {
				teamName = core
			}
		}
		labelYears := make([]string, 0, to-from+1)
		for y := from; y <= to; y++ {
			labelYears = append(labelYears, strconv.Itoa(y))
		}
		out = append(out, models.DriverTeamStint{
			SeriesID:    g.seriesID,
			SeriesName:  g.seriesName,
			TeamName:    teamName,
			From:        strconv.Itoa(from),
			To:          strconv.Itoa(to),
			Years:       labelYears,
			YearsLabel:  formatYearRange(from, to),
			SeasonCount: to - from + 1,
			Starts:      starts,
			CarNumber:   pickVoteWinner(carVotes),
		})
		i = j
	}
	return out
}

func formatYearRange(from, to int) string {
	if from == to {
		return strconv.Itoa(from)
	}
	return strconv.Itoa(from) + "–" + strconv.Itoa(to)
}

func sortTeamStints(stints []models.DriverTeamStint) {
	sort.SliceStable(stints, func(i, j int) bool {
		if stints[i].To != stints[j].To {
			return stints[i].To > stints[j].To
		}
		if stints[i].From != stints[j].From {
			return stints[i].From > stints[j].From
		}
		if stints[i].Starts != stints[j].Starts {
			return stints[i].Starts > stints[j].Starts
		}
		if stints[i].SeriesName != stints[j].SeriesName {
			return stints[i].SeriesName < stints[j].SeriesName
		}
		return stints[i].TeamName < stints[j].TeamName
	})
}

func sortInts(xs []int) {
	sort.Slice(xs, func(i, j int) bool { return xs[i] < xs[j] })
}

func copyIntMap(in map[string]int) map[string]int {
	out := make(map[string]int, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func addIntMap(dst, src map[string]int) {
	for k, v := range src {
		dst[k] += v
	}
}

func pickVoteWinner(votes map[string]int) string {
	best := ""
	bestN := 0
	for name, n := range votes {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if n > bestN ||
			(n == bestN && (len(name) > len(best) || (len(name) == len(best) && name < best))) {
			best = name
			bestN = n
		}
	}
	return best
}
