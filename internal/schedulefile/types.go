package schedulefile

import (
	"fmt"
	"strings"
	"time"

	"github.com/vX8q/tga/models"
)

// EventJSON is an event for JSON storage (dates as YYYY-MM-DD strings).
type EventJSON struct {
	ID          string `json:"id"`
	SeriesID    string `json:"series_id"`
	Season      string `json:"season"`
	Name        string `json:"name"`
	Location    string `json:"location"`
	CircuitName string `json:"circuit_name"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	TimeEST     string `json:"time_est"`
	TimeMSK     string `json:"time_msk"`
}

const dateFormat = "2006-01-02"

// EventToModel converts EventJSON to models.Event (single date-parsing entry point).
// Empty start_date/end_date yield zero time (time.Time{}). Invalid date format returns an error.
func EventToModel(e EventJSON) (*models.Event, error) {
	var start, end time.Time
	if s := strings.TrimSpace(e.StartDate); s != "" {
		t, err := time.Parse(dateFormat, s)
		if err != nil {
			return nil, fmt.Errorf("parse start_date %q for event %q: %w", e.StartDate, e.ID, err)
		}
		start = t
	}
	if s := strings.TrimSpace(e.EndDate); s != "" {
		t, err := time.Parse(dateFormat, s)
		if err != nil {
			return nil, fmt.Errorf("parse end_date %q for event %q: %w", e.EndDate, e.ID, err)
		}
		end = t
	}
	return &models.Event{
		ID:          e.ID,
		SeriesID:    e.SeriesID,
		Season:      e.Season,
		Name:        e.Name,
		Location:    e.Location,
		CircuitName: e.CircuitName,
		StartDate:   start,
		EndDate:     end,
		TimeEST:     e.TimeEST,
		TimeMSK:     e.TimeMSK,
	}, nil
}

// TeamJSON is a team from the Teams sheet / custom files (e.g. IMSA).
type TeamJSON struct {
	Manufacturer string `json:"manufacturer"` // NASCAR series; IndyCar — Engine (Chevrolet/Honda)
	Team         string `json:"team"`
	Number       string `json:"number"`
	Driver       string `json:"driver"` // single driver (legacy format)
	CrewChief    string `json:"crew_chief,omitempty"`
	FullTime     bool   `json:"full_time"`       // true = Full-time, false = Part-time (must be present for split tables)
	Races        string `json:"races,omitempty"` // optional, e.g. for part-time "1"

	// IndyCar: driver country and rookie flag for "Country Name R" display
	DriverCountry string `json:"driver_country,omitempty"`
	Rookie        bool   `json:"rookie,omitempty"`

	// IMSA / custom fields
	Class        string   `json:"class,omitempty"`         // GTP / LMP2 / GTD Pro / GTD
	Chassis      string   `json:"chassis,omitempty"`       // chassis (Porsche 963, Oreca 07, ...)
	Drivers      []string `json:"drivers,omitempty"`       // driver list
	DriverRounds []string `json:"driver_rounds,omitempty"` // rounds per driver (parallel to Drivers)
	Rounds       string   `json:"rounds,omitempty"`        // round schedule (All, "7", "Rolex 24", etc.)

	// F1: power unit (Engine)
	PowerUnit string `json:"power_unit,omitempty"`

	// DTM / GT3 teams-page fields.
	Car    string `json:"car,omitempty"`
	Status string `json:"status,omitempty"`

	// PSC: guest entry — show (G) in teams/entry list only.
	Guest bool `json:"guest,omitempty"`
	Ref    string `json:"ref,omitempty"`
}

// CarModel is a car model (Manufacturer + Model; Truck — TruckBrand).
type CarModel struct {
	Manufacturer string `json:"manufacturer"`
	TruckBrand   string `json:"truck_brand,omitempty"` // Truck: "Chevrolet Silverado", etc.
	Model        string `json:"model"`
}

// SpecRow is a technical specification row (key — value).
type SpecRow struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// TeamsWithSpec is teams + car models + technical specification.
type TeamsWithSpec struct {
	Teams             []TeamJSON `json:"teams"`
	TeamsNonChartered []TeamJSON `json:"teams_non_chartered,omitempty"` // Cup: non-chartered teams
	CarModels         []CarModel `json:"car_models,omitempty"`
	TechnicalSpec     []SpecRow  `json:"technical_spec,omitempty"`
}

// StandingRow is a championship standings row (Pos, Driver, Team, Manufacturer/Car, Pts, Stages + per-race).
type StandingRow struct {
	Pos          int               `json:"pos"`
	Car          string            `json:"car,omitempty"` // car number
	Driver       string            `json:"driver"`
	Team         string            `json:"team"`
	Manufacturer string            `json:"manufacturer"`
	Points       string            `json:"points"`
	Stages       string            `json:"stages,omitempty"`
	Wth          string            `json:"wth,omitempty"`    // withdrawals/DNFs
	Status       string            `json:"status,omitempty"` // e.g. DNQ, Wth
	Races        map[string]string `json:"races,omitempty"`  // race code -> position
}

// StandingsClass is a separate standings table per class (e.g. GTP/LMP2/GTD Pro/GTD for IMSA).
type StandingsClass struct {
	ID   string        `json:"id"`
	Name string        `json:"name"`
	Rows []StandingRow `json:"rows"`
}

// StandingsPointsInfo holds reference tables for the points system (SMP F4, etc.).
type StandingsPointsInfo struct {
	QualifyingPoints *EventTable  `json:"qualifying_points,omitempty"`
	RacePoints       []EventTable `json:"race_points,omitempty"`
}

// StandingsData is a championship table with race column order (DAY, ATL, ...) and, optionally,
// separate tables per class (IMSA, etc.).
// EventNames — round names in the same order as RaceOrder (F1/F2/F3 — top header row).
type StandingsData struct {
	RaceOrder      []string             `json:"race_order,omitempty"`
	EventNames     []string             `json:"event_names,omitempty"` // round name per race (len = len(RaceOrder))
	CompletedRaces []string             `json:"completed_races,omitempty"`
	Rows           []StandingRow        `json:"rows"`
	Ineligible     []StandingRow        `json:"ineligible,omitempty"`
	Classes        []StandingsClass     `json:"classes,omitempty"`
	PointsInfo     *StandingsPointsInfo `json:"points_info,omitempty"`
}

// EventDetailJSON is race details: info, entry list, practice, qualifying, duels, results, etc.
type EventDetailJSON struct {
	EventID        string                `json:"event_id"`
	Series         string                `json:"series,omitempty"`
	Race           string                `json:"race,omitempty"`
	Date           string                `json:"date,omitempty"`
	Track          string                `json:"track,omitempty"`
	Location       string                `json:"location,omitempty"`
	Laps           string                `json:"laps,omitempty"`
	Distance       string                `json:"distance,omitempty"`
	EntryList      []EntryListRow        `json:"entry_list,omitempty"`
	Tables         map[string]EventTable `json:"tables,omitempty"` // practice, qualifying, duel1, duel2, starting_lineup, practice2, final_practice, stage1, stage2, race_results, caution_breakdown
	RaceStatistics map[string]string     `json:"race_statistics,omitempty"`
	EventPreview   string                `json:"event_preview,omitempty"`
	EventPreviewRu string                `json:"event_preview_ru,omitempty"`
	YoutubeID      string                `json:"youtube_id,omitempty"`
}

// EventTable is a table with headers and rows (universal format for Practice, Qualifying, etc.).
type EventTable struct {
	Title    string              `json:"title,omitempty"`
	Headers  []string            `json:"headers"`
	Rows     [][]string          `json:"rows"`
	Sessions []EventTableSession `json:"sessions,omitempty"`
}

// EventTableSession is a session inside a table (common in event JSON: practice/qualifying/race.sessions).
type EventTableSession struct {
	Title   string     `json:"title,omitempty"`
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

// EntryListRow is an entry list row. Base fields (No, Driver, Team, Manufacturer, Crew Chief)
// are used for stock-car; other optional fields cover other series formats
// (F1 constructor, IMSA/ELMS/GTWCE/Super GT class+car+multiple drivers, Super Formula, etc.).
type EntryListRow struct {
	Number       string `json:"number"`
	Driver       string `json:"driver"`
	Team         string `json:"team"`
	Manufacturer string `json:"manufacturer"`
	CrewChief    string `json:"crew_chief,omitempty"`

	// Extra fields for other series.
	Constructor   string `json:"constructor,omitempty"` // F1, Super Formula
	Class         string `json:"class,omitempty"`       // IMSA / ELMS / GTWCE / Super GT
	Car           string `json:"car,omitempty"`         // car model
	Make          string `json:"make,omitempty"`        // Super GT (manufacturer)
	Driver1       string `json:"driver1,omitempty"`     // multi-driver GT/endurance
	Driver2       string `json:"driver2,omitempty"`
	Driver3       string `json:"driver3,omitempty"`
	DriverCountry string `json:"driver_country,omitempty"` // Super Formula
	PowerUnit     string `json:"power_unit,omitempty"`     // DTM
	Status        string `json:"status,omitempty"`         // DTM ("R", etc.)
	Rounds          string `json:"rounds,omitempty"`           // DTM (may appear in entry_list)
	PointsEligible  *bool  `json:"points_eligible,omitempty"` // false = ineligible (i) in stock-car
	Guest           bool   `json:"guest,omitempty"`           // PSC guest entry — show (G) in entry list only
	DriverSlug      string `json:"driver_slug,omitempty"`
}
