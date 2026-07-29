package config

import "strings"

// SeriesType is a series category.
type SeriesType string

const (
	// OpenWheel is an open-wheel series category.
	OpenWheel      SeriesType = "openwheel"
	// GTEndurance is a GT endurance series category.
	GTEndurance    SeriesType = "gt_endurance"
	// GTSprint is a GT sprint series category.
	GTSprint       SeriesType = "gt_sprint"
	// Touring is a touring-car series category.
	Touring        SeriesType = "touring"
	// StockCarRacing is a stock-car series category.
	StockCarRacing SeriesType = "stock_car_racing"
	// SingleMake is a single-make series category.
	SingleMake     SeriesType = "single_make"
)

// Championship is a series/championship.
type Championship struct {
	ID      string
	Name    string
	Season  string
	Type    SeriesType
	Country string
	Active  bool
}

// CurrentSeason is the default season.
const CurrentSeason = "2026"

// SeasonFromSlug returns a 4-digit year from URL/API slugs (f1-2025, indycar_2026) or "".
func SeasonFromSlug(slug string) string {
	s := strings.ToLower(strings.TrimSpace(slug))
	for _, sep := range []string{"-", "_"} {
		idx := strings.LastIndex(s, sep)
		if idx <= 0 || idx+5 != len(s) {
			continue
		}
		y := s[idx+1:]
		if len(y) == 4 && y >= "2000" && y <= "2099" {
			return y
		}
	}
	return ""
}

// KnownSeriesID reports whether a URL slug (f1, f1-2025, nascar-cup, nascar_xfinity)
// maps to a configured championship.
func KnownSeriesID(slug string) bool {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return false
	}
	dataID := DataSeriesID(slug)
	for _, c := range Championships {
		if strings.EqualFold(c.ID, slug) || strings.EqualFold(DataSeriesID(c.ID), dataID) {
			return true
		}
	}
	return false
}

// DataSeriesID returns the identifier for data directories/files (e.g. nascar_xfinity -> noaps).
// For a season slug like "f1-2025" or "indycar_2026" it returns "f1" / "indycar" (season via SeasonFromSlug).
func DataSeriesID(champID string) string {
	s := strings.ToLower(champID)
	if y := SeasonFromSlug(s); y != "" {
		if strings.HasSuffix(s, "-"+y) {
			s = s[:len(s)-5]
		} else if strings.HasSuffix(s, "_"+y) {
			s = s[:len(s)-5]
		}
	}
	// URL-slug uses hyphens (e.g. nascar-cup), data files use underscores (nascar_cup).
	s = strings.ReplaceAll(s, "-", "_")
	if s == "nascar_xfinity" {
		return "noaps"
	}
	return s
}
