package models

// Result is a competitor's result in a race.
type Result struct {
	ID          string
	RaceID      string
	DriverID    string
	TeamID      string
	CarNumber   string
	Position    int       // finishing position (1-based)
	GridPosition int      // starting position
	Laps        int       // laps completed
	LapsLed     int       // laps led
	Status      string    // "finished", "DNF", "DSQ", ...
	Points      float64
	FastestLap  string    // fastest lap time (if any)
}
