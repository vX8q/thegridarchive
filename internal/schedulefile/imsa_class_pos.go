package schedulefile

import (
	"strconv"
	"strings"
)

// FillImsaClassPosInRows backfills empty CLASS POS cells using overall POS rank within CLASS.
// Returns true if any cell was updated.
func FillImsaClassPosInRows(headers []string, rows [][]string) bool {
	colClassPos := firstColIndex(headers, "CLASS POS", "Class Pos")
	colClass := firstColIndex(headers, "CLASS", "Class")
	if colClassPos < 0 || colClass < 0 {
		return false
	}
	changed := false
	for i := range rows {
		row := rows[i]
		if colClassPos >= len(row) {
			continue
		}
		cp := strings.TrimSpace(valueAt(row, colClassPos))
		if cp != "" && cp != "—" && cp != "-" {
			continue
		}
		rank := imsaClassPosition(headers, rows, row)
		if rank <= 0 {
			continue
		}
		for len(rows[i]) <= colClassPos {
			rows[i] = append(rows[i], "")
		}
		rows[i][colClassPos] = strconv.Itoa(rank)
		changed = true
	}
	return changed
}

// FillImsaClassPosInEventDetail updates all IMSA tables/sessions that have CLASS + CLASS POS.
func FillImsaClassPosInEventDetail(detail *EventDetailJSON) bool {
	if detail == nil || detail.Tables == nil {
		return false
	}
	changed := false
	for _, tbl := range detail.Tables {
		if len(tbl.Headers) > 0 {
			if FillImsaClassPosInRows(tbl.Headers, tbl.Rows) {
				changed = true
			}
		}
		for i := range tbl.Sessions {
			s := &tbl.Sessions[i]
			if len(s.Headers) == 0 {
				continue
			}
			if FillImsaClassPosInRows(s.Headers, s.Rows) {
				changed = true
			}
		}
	}
	return changed
}
