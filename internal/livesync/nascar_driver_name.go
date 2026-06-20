package livesync

import (
	"strings"
	"unicode"
)

type nascarCFDriver struct {
	FullName  string `json:"full_name"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func nascarDriverDisplayName(d nascarCFDriver) string {
	full := normalizeNASCARLiveDriverName(d.FullName)
	if full == "" || nascarDriverNameLooksInvalid(full) {
		full = normalizeNASCARLiveDriverName(strings.TrimSpace(d.FirstName + " " + d.LastName))
	}
	if nascarDriverNameLooksInvalid(full) {
		return ""
	}
	return full
}

func normalizeNASCARLiveDriverName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	// NASCAR marks substitute / waiver drivers with a leading asterisk in live feed.
	name = strings.TrimLeft(name, "*")
	name = strings.TrimSpace(name)
	return name
}

func nascarDriverNameLooksInvalid(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return true
	}
	if name == "#" {
		return true
	}
	if strings.HasPrefix(name, "#") && !strings.Contains(name, " ") {
		return true
	}
	if strings.HasSuffix(name, " #") || strings.HasSuffix(name, "#") {
		return true
	}
	// Placeholder tokens sometimes appear when the feed has no driver name yet.
	lower := strings.ToLower(name)
	if lower == "tba" || lower == "tbd" || lower == "unknown" {
		return true
	}
	hasLetter := false
	for _, r := range name {
		if unicode.IsLetter(r) {
			hasLetter = true
			break
		}
	}
	return !hasLetter
}
