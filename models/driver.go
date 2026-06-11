// Package models defines core domain entities.
package models

import "time"

// Driver is a racing driver.
type Driver struct {
	ID          string
	Name        string
	ShortName   string
	Nationality string
	Number      string    // permanent number in the series (if any)
	BirthDate   time.Time
	BirthPlace  string    // birthplace as "City, Region/State, Country" (e.g. Corning, California, U.S.)
	Slug        string    // URL-friendly slug computed from Name
}
