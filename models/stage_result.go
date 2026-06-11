package models

// StageResult is a driver's result in a specific race stage.
type StageResult struct {
	ID        string
	RaceID    string
	SeriesID  string
	Season    string
	StageNo   int
	DriverID  string
	TeamID    string
	CarNumber string
	Position  int
	Laps      int
	Status    string
	Points    int
}

