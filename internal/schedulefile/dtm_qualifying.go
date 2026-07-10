package schedulefile

import (
	"sort"
	"strconv"
	"strings"
)

// dtmQualAward is a qualifying points award (3/2/1) for one race within a DTM weekend.
type dtmQualAward struct {
	driver string
	carNum string
	points float64
}

// dtmQualifyingRaceIndexFromTitle returns 1 or 2 from titles like
// "Qualifying (Race 1)" or "Qualifying (Race 2) - Group B".
func dtmQualifyingRaceIndexFromTitle(title string) int {
	lower := strings.ToLower(strings.TrimSpace(title))
	idx := strings.Index(lower, "race")
	if idx < 0 {
		return 0
	}
	rest := strings.TrimSpace(lower[idx+4:])
	var digits strings.Builder
	for _, r := range rest {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		} else if digits.Len() > 0 {
			break
		}
	}
	if digits.Len() == 0 {
		return 0
	}
	n, err := strconv.Atoi(digits.String())
	if err != nil || n < 1 {
		return 0
	}
	return n
}

func dtmQualGroupLetter(title string) string {
	lower := strings.ToLower(strings.TrimSpace(title))
	switch {
	case strings.Contains(lower, "group a"):
		return "A"
	case strings.Contains(lower, "group b"):
		return "B"
	default:
		return ""
	}
}

type dtmQualCandidate struct {
	driver string
	carNum string
	pos    int
}

func dtmQualDriversFromSession(sess EventTableSession) []dtmQualCandidate {
	if len(sess.Headers) == 0 || len(sess.Rows) == 0 {
		return nil
	}
	driverCol := firstColIndex(sess.Headers, "Driver", "Drivers")
	noCol := firstColIndex(sess.Headers, "No.", "No", "#")
	posCol := firstColIndex(sess.Headers, "Pos", "Pos.", "#")
	if driverCol < 0 {
		return nil
	}
	var out []dtmQualCandidate
	for _, row := range sess.Rows {
		if driverCol >= len(row) {
			continue
		}
		driver := strings.TrimSpace(row[driverCol])
		if driver == "" {
			continue
		}
		carNum := ""
		if noCol >= 0 && noCol < len(row) {
			carNum = strings.TrimSpace(row[noCol])
		}
		pos := 0
		if posCol >= 0 && posCol < len(row) {
			pos, _ = strconv.Atoi(strings.TrimSpace(row[posCol]))
		}
		if pos <= 0 {
			pos = len(out) + 1
		}
		out = append(out, dtmQualCandidate{driver: driver, carNum: carNum, pos: pos})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].pos != out[j].pos {
			return out[i].pos < out[j].pos
		}
		return out[i].driver < out[j].driver
	})
	return out
}

// dtmInterleavedGroupGrid builds the combined starting grid used for DTM qualifying
// points when sessions are split into Group A and Group B: B1, A1, B2, A2, …
func dtmInterleavedGroupGrid(groupB, groupA []dtmQualCandidate) []dtmQualCandidate {
	maxLen := len(groupB)
	if len(groupA) > maxLen {
		maxLen = len(groupA)
	}
	var grid []dtmQualCandidate
	for i := 0; i < maxLen; i++ {
		if i < len(groupB) {
			grid = append(grid, groupB[i])
		}
		if i < len(groupA) {
			grid = append(grid, groupA[i])
		}
	}
	return grid
}

func dtmQualifyingAwards(detail *EventDetailJSON, raceIdx int, entryByCar map[string]string) []dtmQualAward {
	if detail == nil || detail.Tables == nil || raceIdx < 1 {
		return nil
	}
	qual, ok := detail.Tables["qualifying"]
	if !ok || len(qual.Sessions) == 0 {
		return nil
	}

	var groupA, groupB []dtmQualCandidate
	groupMode := false
	for _, sess := range qual.Sessions {
		if dtmQualifyingRaceIndexFromTitle(sess.Title) != raceIdx {
			continue
		}
		letter := dtmQualGroupLetter(sess.Title)
		if letter == "" {
			continue
		}
		groupMode = true
		drivers := dtmQualDriversFromSession(sess)
		switch letter {
		case "A":
			groupA = drivers
		case "B":
			groupB = drivers
		}
	}

	var candidates []dtmQualCandidate
	if groupMode {
		if len(groupA) == 0 && len(groupB) == 0 {
			return nil
		}
		candidates = dtmInterleavedGroupGrid(groupB, groupA)
	} else {
		for _, sess := range qual.Sessions {
			if dtmQualifyingRaceIndexFromTitle(sess.Title) != raceIdx {
				continue
			}
			candidates = dtmQualDriversFromSession(sess)
			if len(candidates) > 0 {
				break
			}
		}
	}
	if len(candidates) == 0 {
		return nil
	}

	bonus := []float64{3, 2, 1}
	var out []dtmQualAward
	for i := 0; i < len(bonus) && i < len(candidates); i++ {
		c := candidates[i]
		driver := c.driver
		if entryByCar != nil && c.carNum != "" {
			if full, ok := entryByCar[c.carNum]; ok && strings.TrimSpace(full) != "" {
				driver = full
			}
		}
		if strings.TrimSpace(driver) == "" {
			continue
		}
		out = append(out, dtmQualAward{driver: driver, carNum: c.carNum, points: bonus[i]})
	}
	return out
}
