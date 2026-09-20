package schedulefile

import (
	"strconv"
	"strings"
)

// PSCPointsScale awards the top fifteen classified eligible drivers per race.
var PSCPointsScale = []int{25, 20, 17, 14, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1}

func pscGuestCarsFromEntry(entry []EntryListRow) map[string]bool {
	out := make(map[string]bool)
	for _, e := range entry {
		if !e.Guest {
			continue
		}
		n := strings.TrimSpace(e.Number)
		if n != "" {
			out[n] = true
		}
	}
	return out
}

func pscIsClassifiedRacePos(pos string) bool {
	pos = strings.TrimSpace(pos)
	if pos == "" {
		return false
	}
	upper := strings.ToUpper(pos)
	switch upper {
	case "DNS", "DNQ", "RET", "DNF", "NC", "DSQ", "EX":
		return false
	}
	_, err := strconv.Atoi(pos)
	return err == nil
}

// pscMetaHalfPoints is true when race_results / race session meta marks a shortened race
// that awards 50% points (<50% of scheduled distance; Art. 8 PMSC).
func pscMetaHalfPoints(meta map[string]string) bool {
	if meta == nil {
		return false
	}
	for _, key := range []string{"half_points", "HalfPoints", "Half points"} {
		v := strings.TrimSpace(strings.ToLower(meta[key]))
		if v == "true" || v == "1" || v == "yes" {
			return true
		}
	}
	return false
}

func formatPSCPoints(pts float64) string {
	if pts == float64(int(pts)) {
		return strconv.Itoa(int(pts))
	}
	s := strconv.FormatFloat(pts, 'f', 1, 64)
	return s
}

// ApplyPSCRacePoints sets the Points column for a PSC race using guest rules:
// guest drivers always score 0; eligible classified finishers receive the next
// points value in PSCPointsScale (guest positions are skipped).
// When table.Meta half_points is true, awards 50% of the scale (shortened race).
func ApplyPSCRacePoints(entry []EntryListRow, table *EventTable) {
	if table == nil || len(table.Headers) == 0 || len(table.Rows) == 0 {
		return
	}
	ptsCol := pointsColIndex(table.Headers)
	if ptsCol < 0 {
		return
	}
	posCol := firstColIndex(table.Headers, "Pos", "Pos.", "Fin")
	carCol := firstColIndex(table.Headers, "No", "No.", "#", "Car")
	guests := pscGuestCarsFromEntry(entry)
	half := pscMetaHalfPoints(table.Meta)
	eligible := 0
	for i := range table.Rows {
		row := table.Rows[i]
		for len(row) <= ptsCol {
			row = append(row, "")
		}
		pts := 0.0
		pos := ""
		if posCol >= 0 && posCol < len(row) {
			pos = row[posCol]
		}
		car := ""
		if carCol >= 0 && carCol < len(row) {
			car = strings.TrimSpace(row[carCol])
		}
		if pscIsClassifiedRacePos(pos) && !guests[car] {
			if eligible < len(PSCPointsScale) {
				pts = float64(PSCPointsScale[eligible])
				if half {
					pts /= 2
				}
			}
			eligible++
		}
		row[ptsCol] = formatPSCPoints(pts)
		table.Rows[i] = row
	}
}

func pscRaceFinishSortKey(pos string) int {
	pos = strings.TrimSpace(pos)
	if pos == "" {
		return 99999
	}
	if n, err := strconv.Atoi(pos); err == nil && n > 0 {
		return n
	}
	switch strings.ToUpper(pos) {
	case "RET", "DNF":
		return 90000
	case "DNS", "DNQ":
		return 91000
	case "DSQ", "EX":
		return 92000
	default:
		return 95000
	}
}

func pscStandingsBestFinish(r StandingRow) int {
	best := 99999
	for _, v := range r.Races {
		if k := pscRaceFinishSortKey(v); k < best {
			best = k
		}
	}
	return best
}

func pscStandingsPoints(raw string) float64 {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

// PSCStandingsRowLess orders PSC standings: points desc, then best race finish asc.
func PSCStandingsRowLess(a, b StandingRow) bool {
	pa := pscStandingsPoints(a.Points)
	pb := pscStandingsPoints(b.Points)
	if pa != pb {
		return pa > pb
	}
	fa := pscStandingsBestFinish(a)
	fb := pscStandingsBestFinish(b)
	if fa != fb {
		return fa < fb
	}
	return strings.ToLower(a.Driver) < strings.ToLower(b.Driver)
}
