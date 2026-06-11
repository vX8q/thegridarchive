package models

// DriverSeasonResult is a driver's result in one race of a season (for the driver page).
type DriverSeasonResult struct {
	SeriesID   string  `json:"series_id"`
	SeriesName string  `json:"series_name"`
	TeamName   string  `json:"team_name,omitempty"`
	EventID    string  `json:"event_id"`
	EventName  string  `json:"event_name"`
	RaceName   string  `json:"race_name"`
	Position   int     `json:"position"`
	Points     float64 `json:"points"`
	Laps       int     `json:"laps"`
	Status     string  `json:"status,omitempty"`
	CarNumber  string  `json:"car_number,omitempty"`
}
