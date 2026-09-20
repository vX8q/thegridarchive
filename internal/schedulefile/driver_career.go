package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/driverutil"
	"github.com/vX8q/tga/models"
)

const (
	achievementKindJewel       = "jewel"
	achievementKindTripleCrown = "triple_crown"
)

var tripleCrownJewelIDs = []string{"f1_monaco", "indy_500", "wec_le_mans"}

type jewelHit struct {
	year    string
	eventID string
}

type f1HistorySeasonRow struct {
	Season               int     `json:"season"`
	DriverChampion       *string `json:"driver_champion"`
	ConstructorsChampion *string `json:"constructors_champion"`
}

// FilterDriverSeasonResults keeps rows for one season (empty season = all).
func FilterDriverSeasonResults(rows []models.DriverSeasonResult, season string) []models.DriverSeasonResult {
	season = strings.TrimSpace(season)
	if season == "" || len(rows) == 0 {
		return rows
	}
	out := make([]models.DriverSeasonResult, 0, len(rows))
	for _, r := range rows {
		if strings.TrimSpace(r.Season) == season {
			out = append(out, r)
		}
	}
	return out
}

// DriverAvailableSeasons returns distinct seasons, newest first.
func DriverAvailableSeasons(rows []models.DriverSeasonResult) []string {
	seen := map[string]struct{}{}
	for _, r := range rows {
		s := strings.TrimSpace(r.Season)
		if s == "" {
			continue
		}
		seen[s] = struct{}{}
	}
	out := make([]string, 0, len(seen))
	for s := range seen {
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] > out[j] })
	return out
}

func driverResultIsWin(r models.DriverSeasonResult) bool {
	if strings.EqualFold(strings.TrimSpace(r.RaceName), "Entry list") {
		return false
	}
	if r.ClassPosition == 1 {
		return true
	}
	return r.Position == 1
}

func seriesDisplayName(seriesID string) string {
	want := strings.ToUpper(strings.TrimSpace(seriesID))
	for _, c := range config.Championships {
		if strings.ToUpper(c.ID) == want {
			return c.Name
		}
	}
	if strings.TrimSpace(seriesID) == "" {
		return ""
	}
	return seriesID
}

// BuildDriverAchievements groups crown-jewel wins (and Triple Crown) from race results.
func BuildDriverAchievements(dataDir string, results []models.DriverSeasonResult) []models.DriverAchievement {
	jewels := LoadCrownJewels(dataDir)
	if len(jewels) == 0 || len(results) == 0 {
		return nil
	}

	hits := map[string][]jewelHit{}
	jewelByID := map[string]CrownJewel{}
	for _, j := range jewels {
		jewelByID[j.ID] = j
	}

	for _, r := range results {
		if !driverResultIsWin(r) {
			continue
		}
		for _, j := range jewels {
			if !j.Match(r.SeriesID, r.EventName, r.CircuitName) {
				continue
			}
			year := strings.TrimSpace(r.Season)
			hits[j.ID] = append(hits[j.ID], jewelHit{year: year, eventID: r.EventID})
		}
	}

	out := make([]models.DriverAchievement, 0, len(hits)+1)
	haveJewel := map[string]bool{}
	for id, list := range hits {
		j, ok := jewelByID[id]
		if !ok || len(list) == 0 {
			continue
		}
		years, eventIDs := uniqueYearsAndEvents(list)
		if len(years) == 0 && len(eventIDs) == 0 {
			continue
		}
		haveJewel[id] = true
		out = append(out, models.DriverAchievement{
			ID:         j.ID,
			Kind:       achievementKindJewel,
			Label:      j.Label,
			LabelRU:    j.LabelRU,
			SeriesID:   firstSeriesID(j.SeriesIDs),
			SeriesName: seriesDisplayName(firstSeriesID(j.SeriesIDs)),
			Years:      years,
			EventIDs:   eventIDs,
			Count:      len(eventIDs),
		})
	}

	if tripleCrownComplete(haveJewel) {
		years := []string{}
		eventIDs := []string{}
		for _, id := range tripleCrownJewelIDs {
			for _, a := range out {
				if a.ID != id {
					continue
				}
				years = append(years, a.Years...)
				eventIDs = append(eventIDs, a.EventIDs...)
			}
		}
		years = uniqueSortedDesc(years)
		out = append([]models.DriverAchievement{{
			ID:       "triple_crown",
			Kind:     achievementKindTripleCrown,
			Label:    "Triple Crown of Motorsport",
			LabelRU:  "Тройная корона автоспорта",
			Years:    years,
			EventIDs: uniquePreserve(eventIDs),
			Count:    1,
		}}, out...)
	}

	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind == achievementKindTripleCrown
		}
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Label < out[j].Label
	})
	return out
}

func firstSeriesID(ids []string) string {
	if len(ids) == 0 {
		return ""
	}
	return ids[0]
}

func uniqueYearsAndEvents(list []jewelHit) (years []string, eventIDs []string) {
	byYear := map[string]string{}
	seenEvent := map[string]struct{}{}
	var uniqueEvents []string
	for _, h := range list {
		y := strings.TrimSpace(h.year)
		e := strings.TrimSpace(h.eventID)
		if y != "" {
			if _, ok := byYear[y]; !ok {
				byYear[y] = e
			}
		}
		if e != "" {
			if _, ok := seenEvent[e]; !ok {
				seenEvent[e] = struct{}{}
				uniqueEvents = append(uniqueEvents, e)
			}
		}
	}
	for y := range byYear {
		years = append(years, y)
	}
	sort.Slice(years, func(i, j int) bool { return years[i] > years[j] })
	aligned := make([]string, 0, len(years))
	for _, y := range years {
		aligned = append(aligned, byYear[y])
	}
	if len(aligned) > 0 {
		return years, aligned
	}
	return years, uniqueEvents
}

func uniqueSortedDesc(in []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] > out[j] })
	return out
}

func uniquePreserve(in []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

func tripleCrownComplete(have map[string]bool) bool {
	for _, id := range tripleCrownJewelIDs {
		if !have[id] {
			return false
		}
	}
	return true
}

// BuildDriverTitles returns championship titles (currently F1 history 1950–present).
func BuildDriverTitles(dataDir, driverSlug string) []models.DriverTitle {
	driverSlug = driverutil.NormalizeSlug(strings.TrimSpace(driverSlug))
	if driverSlug == "" {
		return nil
	}
	seasons := loadF1DriverChampionSeasons(dataDir, driverSlug)
	if len(seasons) == 0 {
		return nil
	}
	return []models.DriverTitle{{
		SeriesID:   "F1",
		SeriesName: seriesDisplayName("F1"),
		Label:      "Formula 1 World Champion",
		LabelRU:    "Чемпион мира Формулы-1",
		Seasons:    seasons,
		Count:      len(seasons),
	}}
}

func loadF1DriverChampionSeasons(dataDir, driverSlug string) []string {
	path := filepath.Join(dataDir, "f1_seasons_history.json")
	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		return nil
	}
	var rows []f1HistorySeasonRow
	if err := json.Unmarshal(b, &rows); err != nil {
		return nil
	}
	var seasons []string
	for _, row := range rows {
		if row.DriverChampion == nil {
			continue
		}
		name := strings.TrimSpace(*row.DriverChampion)
		if name == "" {
			continue
		}
		if driverutil.NormalizeSlug(driverutil.Slug(name)) != driverSlug {
			continue
		}
		if row.Season <= 0 {
			continue
		}
		seasons = append(seasons, strconv.Itoa(row.Season))
	}
	sort.Slice(seasons, func(i, j int) bool { return seasons[i] > seasons[j] })
	return seasons
}
