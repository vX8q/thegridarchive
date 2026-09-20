package models

// DriverAchievement is a signature-race win (crown jewel) on the driver profile.
type DriverAchievement struct {
	ID         string   `json:"id"`
	Kind       string   `json:"kind"` // jewel | triple_crown
	Label      string   `json:"label"`
	LabelRU    string   `json:"label_ru,omitempty"`
	SeriesID   string   `json:"series_id,omitempty"`
	SeriesName string   `json:"series_name,omitempty"`
	Years      []string `json:"years"`
	EventIDs   []string `json:"event_ids,omitempty"`
	Count      int      `json:"count"`
}

// DriverTitle is a championship title on the driver profile.
type DriverTitle struct {
	SeriesID   string   `json:"series_id"`
	SeriesName string   `json:"series_name"`
	Label      string   `json:"label"`
	LabelRU    string   `json:"label_ru,omitempty"`
	Seasons    []string `json:"seasons"`
	Count      int      `json:"count"`
}

// DriverTeamStint is consecutive seasons with the same team on the driver profile.
type DriverTeamStint struct {
	SeriesID    string   `json:"series_id"`
	SeriesName  string   `json:"series_name"`
	TeamName    string   `json:"team_name"`
	From        string   `json:"from"`
	To          string   `json:"to"`
	Years       []string `json:"years"`
	YearsLabel  string   `json:"years_label"`
	SeasonCount int      `json:"season_count"`
	Starts      int      `json:"starts"`
	CarNumber   string   `json:"car_number,omitempty"`
}
