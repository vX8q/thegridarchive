package models

import "time"

// Event is a race weekend / round (e.g. one F1 calendar round).
type Event struct {
	ID             string
	SeriesID       string
	Season         string
	Name           string    // round name (e.g. "Bahrain GP")
	Location       string    // country/circuit
	CircuitName    string
	StartDate      time.Time
	EndDate        time.Time
	TimeEST        string    // start time EST from Excel (e.g. "1:30 PM")
	TimeMSK        string    // MSK time (e.g. "2/15/26 21:30")
}
