package config

import "strings"

// SeriesSearchPriority mirrors web/data/search-priority.js (highest first).
var SeriesSearchPriority = []string{
	"F1",
	"INDYCAR",
	"WEC",
	"NASCAR_CUP",
	"SUPER_FORMULA",
	"IMSA",
	"DTM",
	"SUPER_GT",
	"F2",
	"GTWCE_END",
	"GTWCE_SPRINT",
	"ELMS",
	"SUPERCARS",
	"NOAPS",
	"F3",
	"NASCAR_TRUCK",
	"PSC",
	"ARCA",
	"FREC",
	"F4_IT",
	"NASCAR_MODIFIED",
}

// SeriesPriorityScore returns a higher value for series ranked earlier in SeriesSearchPriority.
func SeriesPriorityScore(seriesID string) int {
	sid := strings.ToUpper(strings.TrimSpace(seriesID))
	n := len(SeriesSearchPriority)
	for i, id := range SeriesSearchPriority {
		if strings.EqualFold(id, sid) {
			return (n - i) + 100
		}
	}
	return 0
}
