package models

// TeamSeasonResult is one car/driver result for a team org in a race (team page).
type TeamSeasonResult struct {
	SeriesID      string  `json:"series_id"`
	SeriesName    string  `json:"series_name"`
	TeamName      string  `json:"team_name,omitempty"`
	DriverName    string  `json:"driver_name,omitempty"`
	EventID       string  `json:"event_id"`
	EventName     string  `json:"event_name"`
	RaceName      string  `json:"race_name"`
	Season        string  `json:"season,omitempty"`
	CircuitName   string  `json:"circuit_name,omitempty"`
	Position      int     `json:"position"`
	ClassPosition int     `json:"class_position,omitempty"`
	Points        float64 `json:"points"`
	Laps          int     `json:"laps"`
	Status        string  `json:"status,omitempty"`
	CarNumber     string  `json:"car_number,omitempty"`
	Class         string  `json:"class,omitempty"`
}

// TeamRosterSeat is one entry-list seat for a team org in a season.
type TeamRosterSeat struct {
	SeriesID   string `json:"series_id"`
	SeriesName string `json:"series_name"`
	Season     string `json:"season"`
	CarNumber  string `json:"car_number,omitempty"`
	DriverName string `json:"driver_name,omitempty"`
	Class      string `json:"class,omitempty"`
	FullTime   *bool  `json:"full_time,omitempty"`
	Rounds     string `json:"rounds,omitempty"`
}
