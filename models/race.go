package models

import "time"

// Race is a single race (results, grid, lap leaders).
type Race struct {
	ID          string
	EventID     string
	SeriesID    string
	Season      string
	Name        string    // "Race", "Sprint", "Feature", etc.
	ScheduleAt  time.Time
	Laps        int
	Distance    string    // e.g. "305 km"
	Status      string    // "scheduled", "completed", "cancelled"
}
