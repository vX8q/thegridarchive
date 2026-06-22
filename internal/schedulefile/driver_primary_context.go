package schedulefile

import (
	"strings"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/driverutil"
	"github.com/vX8q/tga/models"
)

// DriverPrimaryContext is the series/team shown for a driver in search and profile headers.
type DriverPrimaryContext struct {
	SeriesID   string `json:"series_id"`
	SeriesName string `json:"series_name"`
	TeamName   string `json:"team_name"`
	Starts     int    `json:"starts"`
}

type driverSeriesAgg struct {
	seriesName string
	starts     int
	teams      map[string]int
}

type driverPrimaryAgg struct {
	bySeries map[string]*driverSeriesAgg
}

// BuildAllDriverPrimaryContext counts race starts per series from event JSON (race_results).
func BuildAllDriverPrimaryContext(dataDir, season string) (map[string]DriverPrimaryContext, error) {
	season = strings.TrimSpace(season)
	all := map[string]*driverPrimaryAgg{}

	for _, champ := range config.Championships {
		events, err := LoadEvents(dataDir, champ.ID)
		if err != nil || len(events) == 0 {
			continue
		}
		seriesID := champ.ID
		seriesName := champ.Name

		for _, ev := range events {
			if season != "" && ev.Season != season {
				continue
			}
			detail, err := LoadEventDetail(dataDir, ev.ID)
			if err != nil || detail == nil || detail.Tables == nil {
				continue
			}

			if headers, rows, ok := tableHeadersRows(detail.Tables, "race_results"); ok {
				accumulateRaceStarts(all, seriesID, seriesName, headers, rows)
				continue
			}
			if headers, rows, ok := tableHeadersRows(detail.Tables, "race"); ok {
				accumulateRaceStarts(all, seriesID, seriesName, headers, rows)
			}
		}
	}

	out := make(map[string]DriverPrimaryContext, len(all))
	for slug, agg := range all {
		out[slug] = pickPrimaryFromAgg(agg)
	}
	return out, nil
}

// PickDriverPrimaryContextFromResults derives primary series/team from a driver's season rows.
func PickDriverPrimaryContextFromResults(rows []models.DriverSeasonResult) DriverPrimaryContext {
	agg := &driverPrimaryAgg{bySeries: map[string]*driverSeriesAgg{}}
	for _, r := range rows {
		if strings.EqualFold(strings.TrimSpace(r.Status), "Entry list") {
			continue
		}
		seriesID := strings.TrimSpace(r.SeriesID)
		if seriesID == "" {
			continue
		}
		sa := agg.bySeries[seriesID]
		if sa == nil {
			sa = &driverSeriesAgg{teams: map[string]int{}}
			agg.bySeries[seriesID] = sa
		}
		sa.seriesName = strings.TrimSpace(r.SeriesName)
		sa.starts++
		team := strings.TrimSpace(r.TeamName)
		if team != "" {
			sa.teams[team]++
		}
	}
	return pickPrimaryFromAgg(agg)
}

func accumulateRaceStarts(all map[string]*driverPrimaryAgg, seriesID, seriesName string, headers []string, rows [][]string) {
	if len(headers) == 0 || len(rows) == 0 {
		return
	}

	colDriver := firstColIndex(headers, "Driver", "Drivers", "Driver Name")
	colPos := firstColIndex(headers, "Pos", "Fin")
	if colPos < 0 {
		colPos = firstColIndex(headers, "Fin.")
	}
	colNo := firstColIndex(headers, "No", "No.", "#", "Car", "Car No", "CAR NO")
	colLaps := firstColIndex(headers, "Laps", "No Laps", "NO LAPS", "Laps Completed")
	colTeam := firstColIndex(headers, "Team", "Entrant", "Constructor")
	if colDriver < 0 || colPos < 0 || colNo < 0 || colLaps < 0 {
		return
	}

	for _, row := range rows {
		driverCell := valueAt(row, colDriver)
		if driverCell == "" {
			continue
		}
		teamName := valueAt(row, colTeam)
		for _, candidate := range extractDriverNameCandidates(driverCell) {
			slug := searchDriverSlug(candidate)
			if slug == "" {
				continue
			}
			da := all[slug]
			if da == nil {
				da = &driverPrimaryAgg{bySeries: map[string]*driverSeriesAgg{}}
				all[slug] = da
			}
			sa := da.bySeries[seriesID]
			if sa == nil {
				sa = &driverSeriesAgg{teams: map[string]int{}}
				da.bySeries[seriesID] = sa
			}
			sa.seriesName = seriesName
			sa.starts++
			if teamName != "" {
				sa.teams[teamName]++
			}
		}
	}
}

func pickPrimaryFromAgg(agg *driverPrimaryAgg) DriverPrimaryContext {
	if agg == nil || len(agg.bySeries) == 0 {
		return DriverPrimaryContext{}
	}

	bestSeriesID := ""
	bestStarts := -1
	bestPriority := -1
	for seriesID, sa := range agg.bySeries {
		if sa == nil {
			continue
		}
		priority := config.SeriesPriorityScore(seriesID)
		if sa.starts > bestStarts ||
			(sa.starts == bestStarts && priority > bestPriority) ||
			(sa.starts == bestStarts && priority == bestPriority && seriesID < bestSeriesID) {
			bestSeriesID = seriesID
			bestStarts = sa.starts
			bestPriority = priority
		}
	}

	sa := agg.bySeries[bestSeriesID]
	bestTeam := ""
	bestTeamCount := -1
	for team, cnt := range sa.teams {
		if cnt > bestTeamCount || (cnt == bestTeamCount && team < bestTeam) {
			bestTeam = team
			bestTeamCount = cnt
		}
	}

	return DriverPrimaryContext{
		SeriesID:   bestSeriesID,
		SeriesName: sa.seriesName,
		TeamName:   bestTeam,
		Starts:     bestStarts,
	}
}

// searchDriverSlug matches frontend driverDisplayName + slugify for search/profile links.
func searchDriverSlug(name string) string {
	n := strings.TrimSpace(name)
	if n == "" {
		return ""
	}
	n = strings.TrimLeft(n, "*")
	n = strings.TrimSpace(n)
	n = strings.TrimRight(n, "*")
	n = strings.TrimSpace(n)
	lower := strings.ToLower(n)
	for _, suf := range []string{"(i)", "(r)", "(g)"} {
		if strings.HasSuffix(lower, suf) {
			n = strings.TrimSpace(n[:len(n)-len(suf)])
			lower = strings.ToLower(n)
		}
	}
	return driverutil.Slug(n)
}
