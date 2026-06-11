package main

import (
	"regexp"
)

// eventSeriesIDRe allows only letters, digits, underscore, and hyphen (for eventID and seriesID from the URL).
var eventSeriesIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// ValidEventOrSeriesID returns true if s is valid for eventID or seriesID (no path traversal or special characters).
func ValidEventOrSeriesID(s string) bool {
	if s == "" || len(s) > 128 {
		return false
	}
	return eventSeriesIDRe.MatchString(s)
}
