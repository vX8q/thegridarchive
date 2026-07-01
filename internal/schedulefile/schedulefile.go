package schedulefile

import (
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/vX8q/tga/models"
)

func nullFloat64(v sql.NullFloat64) float64 {
	if v.Valid {
		return v.Float64
	}
	return 0
}

// SaveEvents saves events to data/schedules/{seriesID}.json
func SaveEvents(dataDir string, seriesID string, events []models.Event) error {
	if len(events) == 0 {
		return nil
	}
	out := make([]EventJSON, len(events))
	for i, e := range events {
		out[i] = EventJSON{
			ID:          e.ID,
			SeriesID:    e.SeriesID,
			Season:      e.Season,
			Name:        e.Name,
			Location:    e.Location,
			CircuitName: e.CircuitName,
			StartDate:   e.StartDate.Format(dateFormat),
			EndDate:     e.EndDate.Format(dateFormat),
			TimeEST:     e.TimeEST,
			TimeMSK:     e.TimeMSK,
		}
	}
	return saveJSONFile(eventsPath(dataDir, seriesID), out)
}

// LoadEvents loads events from data/schedules/{seriesID}.json
func LoadEvents(dataDir string, seriesID string) ([]EventJSON, error) {
	b, err := readFileIfExists(eventsPath(dataDir, seriesID))
	if err != nil || b == nil {
		return nil, err
	}
	var out []EventJSON
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// (team and spec types moved to types.go)

// SaveTeams saves team data for a series.
func SaveTeams(dataDir string, seriesID string, data *TeamsWithSpec) error {
	if data == nil || (len(data.Teams) == 0 && len(data.CarModels) == 0 && len(data.TechnicalSpec) == 0) {
		return nil
	}
	// Backward compatibility: teams only without wrapper — save as legacy array
	if len(data.CarModels) == 0 && len(data.TechnicalSpec) == 0 && len(data.TeamsNonChartered) == 0 {
		return saveJSONFile(teamsPath(dataDir, seriesID), data.Teams)
	}
	return saveJSONFile(teamsPath(dataDir, seriesID), data)
}

// LoadTeamsForSeason loads teams; when season is set, tries seriesID_season.json (e.g. f1_2025).
// For F1 2026, if f1_2026 is missing, falls back to base f1.json (2026 data).
func LoadTeamsForSeason(dataDir string, seriesID string, season string) (*TeamsWithSpec, error) {
	if season != "" {
		seasonID := strings.ToLower(seriesID) + "_" + season
		if data, err := LoadTeams(dataDir, seasonID); err == nil && data != nil && len(data.Teams) > 0 {
			return data, nil
		}
		// F1 2026: no f1_2026.json — use base f1.json (current 2026 teams).
		if strings.EqualFold(seriesID, "f1") && season == "2026" {
			if data, err := LoadTeams(dataDir, "f1"); err == nil && data != nil && len(data.Teams) > 0 {
				return data, nil
			}
		}
	}
	return LoadTeams(dataDir, seriesID)
}

// LoadTeams loads team data for a series.
func LoadTeams(dataDir string, seriesID string) (*TeamsWithSpec, error) {
	b, err := readFileIfExists(teamsPath(dataDir, seriesID))
	if err != nil {
		return nil, err
	}
	if len(b) == 0 {
		return &TeamsWithSpec{}, nil
	}
	// Try as object { teams, car_models, technical_spec }
	var withSpec TeamsWithSpec
	if err := json.Unmarshal(b, &withSpec); err == nil && (len(withSpec.Teams) > 0 || len(withSpec.CarModels) > 0 || len(withSpec.TechnicalSpec) > 0) {
		return &withSpec, nil
	}
	// Otherwise as team array (legacy format)
	var arr []TeamJSON
	if err := json.Unmarshal(b, &arr); err != nil {
		return &TeamsWithSpec{}, nil
	}
	return &TeamsWithSpec{Teams: arr}, nil
}

// (StandingRow and StandingsData types moved to types.go)

// DriverStatsRow contains per-driver statistics for season pages.
type DriverStatsRow struct {
	Driver           string  `json:"driver"`
	Team             string  `json:"team"`
	Manufacturer     string  `json:"manufacturer"`
	Class            string  `json:"class,omitempty"`
	Chassis          string  `json:"chassis,omitempty"` // chassis (F1, etc.)
	Car              string  `json:"car,omitempty"`
	Races            int     `json:"races"`
	Wins             int     `json:"wins"`
	Points           float64 `json:"points,omitempty"`
	Top2             int     `json:"top2,omitempty"`
	Top3             int     `json:"top3,omitempty"`
	Podiums          int     `json:"podiums,omitempty"` // wins + top2 + top3 (all podium finishes)
	Poles            int     `json:"poles"`
	Top5             int     `json:"top5"`
	Top10            int     `json:"top10"`
	Top15            int     `json:"top15"`
	Top20            int     `json:"top20"`
	FastestLaps      int     `json:"fastest_laps,omitempty"`
	BestLap          string  `json:"best_lap,omitempty"` // best lap of season (string, from results.fastest_lap)
	DNFs             int     `json:"dnfs,omitempty"`
	SprintWins       int     `json:"sprint_wins,omitempty"`
	SprintPodiums    int     `json:"sprint_podiums,omitempty"`
	FeatureWins      int     `json:"feature_wins,omitempty"`
	FeaturePodiums   int     `json:"feature_podiums,omitempty"`
	AvgFinish        float64 `json:"avg_finish"`
	AvgStart         float64 `json:"avg_start"`
	QualAppearances  int     `json:"-"` // qualifying/grid samples (Supercars stats merge)
	AvgQualifying    float64 `json:"avg_qualifying,omitempty"` // average qualifying position (F1)
	Q2Passes         int     `json:"q2_passes,omitempty"`      // Q2 passes (F1)
	Q3Passes         int     `json:"q3_passes,omitempty"`      // Q3 passes (F1)
	StageWins        int     `json:"stage_wins"`
	StagePoints      int     `json:"stage_points,omitempty"`
	AvgStagePoints   float64 `json:"avg_stage_points,omitempty"`
	LapsLed          int     `json:"laps_led"`
	LapsCompleted    int     `json:"laps_completed,omitempty"`
	LapsCompletedPct float64 `json:"laps_completed_pct"`
	PositionDiff     float64 `json:"pos_diff"`
}

// ManufacturerStatsRow is aggregated stats by make/manufacturer.
type ManufacturerStatsRow struct {
	Manufacturer     string  `json:"manufacturer"`
	Races            int     `json:"races"`
	Wins             int     `json:"wins"`
	Points           float64 `json:"points,omitempty"`
	Top2             int     `json:"top2,omitempty"`
	Top3             int     `json:"top3,omitempty"`
	Podiums          int     `json:"podiums,omitempty"`
	Poles            int     `json:"poles,omitempty"`
	Top5             int     `json:"top5,omitempty"`
	Top10            int     `json:"top10,omitempty"`
	Top15            int     `json:"top15,omitempty"`
	Top20            int     `json:"top20,omitempty"`
	FastestLaps      int     `json:"fastest_laps,omitempty"`
	DNFs             int     `json:"dnfs,omitempty"`
	SprintWins       int     `json:"sprint_wins,omitempty"`
	SprintPodiums    int     `json:"sprint_podiums,omitempty"`
	FeatureWins      int     `json:"feature_wins,omitempty"`
	FeaturePodiums   int     `json:"feature_podiums,omitempty"`
	AvgFinish        float64 `json:"avg_finish"`
	AvgStart         float64 `json:"avg_start"`
	AvgQualifying    float64 `json:"avg_qualifying,omitempty"`
	Q2Passes         int     `json:"q2_passes,omitempty"`
	Q3Passes         int     `json:"q3_passes,omitempty"`
	StageWins        int     `json:"stage_wins,omitempty"`
	StagePoints      int     `json:"stage_points,omitempty"`
	AvgStagePoints   float64 `json:"avg_stage_points,omitempty"`
	LapsLed          int     `json:"laps_led"`
	LapsCompleted    int     `json:"laps_completed,omitempty"`
	LapsCompletedPct float64 `json:"laps_completed_pct,omitempty"`
	PositionDiff     float64 `json:"pos_diff,omitempty"`
}

// TeamStatsRow is aggregated stats by team.
type TeamStatsRow struct {
	Team             string  `json:"team"`
	Races            int     `json:"races"`
	Wins             int     `json:"wins"`
	Points           float64 `json:"points,omitempty"`
	Poles            int     `json:"poles"`
	Top2             int     `json:"top2,omitempty"`
	Top3             int     `json:"top3,omitempty"`
	Podiums          int     `json:"podiums,omitempty"`
	Top5             int     `json:"top5"`
	Top10            int     `json:"top10"`
	Top15            int     `json:"top15"`
	Top20            int     `json:"top20"`
	AvgFinish        float64 `json:"avg_finish"`
	AvgStart         float64 `json:"avg_start"`
	FastestLaps      int     `json:"fastest_laps,omitempty"`
	DNFs             int     `json:"dnfs,omitempty"`
	SprintWins       int     `json:"sprint_wins,omitempty"`
	SprintPodiums    int     `json:"sprint_podiums,omitempty"`
	FeatureWins      int     `json:"feature_wins,omitempty"`
	FeaturePodiums   int     `json:"feature_podiums,omitempty"`
	StageWins        int     `json:"stage_wins"`
	StagePoints      int     `json:"stage_points,omitempty"`
	AvgStagePoints   float64 `json:"avg_stage_points,omitempty"`
	LapsLed          int     `json:"laps_led"`
	LapsCompletedPct float64 `json:"laps_completed_pct"`
	PositionDiff     float64 `json:"pos_diff"`
}

// DriverStatsClass groups stats rows by class for multiclass championships.
type DriverStatsClass struct {
	ID            string                 `json:"id"`
	Name          string                 `json:"name"`
	Rows          []DriverStatsRow       `json:"rows"`
	Teams         []TeamStatsRow         `json:"teams,omitempty"`
	Manufacturers []ManufacturerStatsRow `json:"manufacturers,omitempty"`
}

// DriverStatsData is a collection of driver, team, and manufacturer stats.
type DriverStatsData struct {
	Rows          []DriverStatsRow       `json:"rows"`
	Teams         []TeamStatsRow         `json:"teams,omitempty"`
	Manufacturers []ManufacturerStatsRow `json:"manufacturers,omitempty"`
	Classes       []DriverStatsClass     `json:"classes,omitempty"`
}

// SaveStandings saves standings data for a series.
func SaveStandings(dataDir string, seriesID string, data *StandingsData) error {
	if data == nil || len(data.Rows) == 0 {
		return nil
	}
	return saveJSONFile(standingsPath(dataDir, seriesID), data)
}

// LoadStandings loads standings data for a series.
func LoadStandings(dataDir string, seriesID string) (*StandingsData, error) {
	b, err := readFileIfExists(standingsPath(dataDir, seriesID))
	if err != nil || b == nil {
		return nil, err
	}
	var out StandingsData
	if err := json.Unmarshal(b, &out); err != nil {
		// Legacy format: StandingRow array
		var arr []StandingRow
		if err2 := json.Unmarshal(b, &arr); err2 != nil {
			return nil, err
		}
		return &StandingsData{Rows: arr}, nil
	}
	return &out, nil
}

// (EventDetailJSON/EventTable/EntryListRow types moved to types.go)

// SaveEventDetail saves event detail JSON.
func SaveEventDetail(dataDir string, eventID string, detail *EventDetailJSON) error {
	return saveJSONFile(eventDetailPath(dataDir, eventID), detail)
}

// LoadEventDetail loads event detail JSON.
func LoadEventDetail(dataDir string, eventID string) (*EventDetailJSON, error) {
	b, err := readEventDetailFile(dataDir, strings.ToLower(eventID))
	if err != nil || b == nil {
		return nil, err
	}
	var out EventDetailJSON
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// BuildDriverStatsFromEvents keeps legacy API compatibility and always uses the JSON path.
// For server endpoints with DB, call BuildDriverStatsFromDB with an open *sql.DB.
func BuildDriverStatsFromEvents(dataDir string, seriesID string, season string) (*DriverStatsData, error) {
	return buildDriverStatsFromJSON(dataDir, seriesID, season)
}
