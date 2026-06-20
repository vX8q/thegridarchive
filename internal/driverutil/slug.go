// Package driverutil provides helpers for driver identifiers.
package driverutil

import (
	"regexp"
	"strings"
)

// SlugRe replaces runs of non-alphanumeric characters (Latin, Cyrillic, digits) with a single hyphen.
var SlugRe = regexp.MustCompile(`[^a-z0-9\p{Cyrillic}]+`)

var diacritics = strings.NewReplacer(
	"ü", "u", "Ü", "u",
	"é", "e", "É", "e",
	"á", "a", "Á", "a",
	"í", "i", "Í", "i",
	"ó", "o", "Ó", "o",
	"ú", "u", "Ú", "u",
	"ñ", "n", "Ñ", "n",
	"ä", "a", "Ä", "a",
	"ö", "o", "Ö", "o",
	"ß", "ss",
	"ø", "o", "Ø", "o",
	"å", "a", "Å", "a",
	"æ", "ae", "Æ", "ae",
	"ç", "c", "Ç", "c",
	"è", "e", "È", "e",
	"ê", "e", "Ê", "e",
	"ë", "e", "Ë", "e",
	"ì", "i", "Ì", "i",
	"î", "i", "Î", "i",
	"ï", "i", "Ï", "i",
	"ò", "o", "Ò", "o",
	"ô", "o", "Ô", "o",
	"ù", "u", "Ù", "u",
	"û", "u", "Û", "u",
	"ý", "y", "Ý", "y",
	"ÿ", "y",
	"ž", "z", "Ž", "z",
	"š", "s", "Š", "s",
	"č", "c", "Č", "c",
	"ř", "r", "Ř", "r",
	"ď", "d", "Ď", "d",
	"ť", "t", "Ť", "t",
	"ň", "n", "Ň", "n",
	"ł", "l", "Ł", "l",
	"ą", "a", "Ą", "a",
	"ę", "e", "Ę", "e",
	"ś", "s", "Ś", "s",
	"ź", "z", "Ź", "z",
	"ż", "z", "Ż", "z",
	"ć", "c", "Ć", "c",
	"ő", "o", "Ő", "o",
	"ű", "u", "Ű", "u",
)

// Slug returns a URL slug from a name (to match the frontend).
func Slug(name string) string {
	s := strings.TrimSpace(strings.ToLower(name))
	s = diacritics.Replace(s)
	s = SlugRe.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// FoldDiacritics replaces common latin diacritics with ASCII equivalents.
// It keeps separators/casing as-is and is suitable for display/search normalization.
func FoldDiacritics(s string) string {
	return diacritics.Replace(strings.TrimSpace(s))
}

// NormalizeKey normalizes a string for use in IDs (lowercase, spaces/hyphens to underscores, no dots or apostrophes).
func NormalizeKey(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, "-", "_")
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, "'", "")
	return s
}

// NormalizeSlug maps legacy or alternate driver URL slugs to the canonical slug.
func NormalizeSlug(slug string) string {
	switch strings.ToLower(strings.TrimSpace(slug)) {
	case "nico-h-lkenberg", "nicolas-hulkenberg", "nicolas-h-lkenberg":
		return "nico-hulkenberg"
	case "sergio-p-rez", "sergio-pérez":
		return "sergio-perez"
	case "connor-zilisch-r":
		return "connor-zilisch"
	case "aj-allmendinger", "a-j-allmendinger-i":
		return "a-j-allmendinger"
	case "bj-mcleod", "b-j-mcleod-i", "bj-mcleod-i":
		return "b-j-mcleod"
	case "jj-yeley", "j-j-yeley-i", "jj-yeley-i":
		return "j-j-yeley"
	case "corey-la-joie":
		return "corey-lajoie"
	case "matt-di-benedetto":
		return "matt-dibenedetto"
	case "rinus-vee-kay":
		return "rinus-veekay"
	case "julian-da-costa-r":
		return "julian-dacosta-r"
	case "antonio-felixda-costa":
		return "antonio-felix-da-costa"
	case "a-j-muss":
		return "aj-muss"
	case "cem-bolukba-i":
		return "cem-bolukbasi"
	case "rafael-c-mara":
		return "rafael-camara"
	case "woohyun-shin", "w-shin", "m-shin":
		return "michael-shin"
	default:
		return strings.ToLower(strings.TrimSpace(slug))
	}
}

// MakeDriverID builds a driver ID from series, name, and optionally car number.
func MakeDriverID(seriesID, driverName, carNumber string) string {
	base := NormalizeKey(driverName)
	if carNumber != "" {
		return strings.ToUpper(seriesID) + ":DRIVER:" + carNumber + ":" + base
	}
	return strings.ToUpper(seriesID) + ":DRIVER:" + base
}
