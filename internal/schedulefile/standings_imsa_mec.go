package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Michelin Endurance Cup (MEC) rounds in the IWSC calendar.
var imsaMecRoundCodes = map[string]struct{}{
	"DAY24": {},
	"SEB12": {},
	"WG":    {},
	"RA":    {},
	"PLM":   {},
}

func imsaIsMecRound(code string) bool {
	_, ok := imsaMecRoundCodes[strings.TrimSpace(code)]
	return ok
}

type imsaMecOfficialFile struct {
	Season  string                                   `json:"season"`
	Classes map[string]map[string]map[string]float64 `json:"classes"` // class -> car -> round -> pts
}

func loadImsaMecOfficial(dataDir, season string) *imsaMecOfficialFile {
	path := filepath.Join(dataDir, "imsa_mec_official.json")
	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		return nil
	}
	var doc imsaMecOfficialFile
	if err := json.Unmarshal(b, &doc); err != nil {
		return nil
	}
	if strings.TrimSpace(season) != "" && strings.TrimSpace(doc.Season) != "" &&
		strings.TrimSpace(doc.Season) != strings.TrimSpace(season) {
		return nil
	}
	return &doc
}

func imsaMecOfficialHasRound(doc *imsaMecOfficialFile, code string) bool {
	if doc == nil {
		return false
	}
	code = strings.TrimSpace(code)
	for _, cars := range doc.Classes {
		for _, rounds := range cars {
			if _, ok := rounds[code]; ok {
				return true
			}
		}
	}
	return false
}

func imsaMecCarCandidates(cls, car string) []string {
	car = strings.TrimSpace(car)
	out := []string{car}
	if cls == "GTP" {
		if car == "5" {
			out = append(out, "85")
		}
		if car == "85" {
			out = append(out, "5")
		}
	}
	if isAllDigits(car) {
		out = append(out, strconv.Itoa(atoiSafe(car)))
	}
	seen := map[string]struct{}{}
	var deduped []string
	for _, c := range out {
		c = strings.TrimSpace(c)
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		deduped = append(deduped, c)
	}
	return deduped
}

func imsaFindMecAcc(
	buckets map[string]*classCarAcc,
	cls, car string,
	getAcc func(cls, car string) *classCarAcc,
) *classCarAcc {
	candidates := imsaMecCarCandidates(cls, car)
	prefix := cls + "\x00"
	var matches []*classCarAcc
	for k, a := range buckets {
		if a == nil || !strings.HasPrefix(k, prefix) {
			continue
		}
		for _, c := range candidates {
			if carNumbersMatch(a.car, c) {
				matches = append(matches, a)
				break
			}
		}
	}
	if len(matches) == 0 {
		return getAcc(cls, car)
	}
	for _, a := range matches {
		if strings.TrimSpace(a.car) == strings.TrimSpace(car) {
			return a
		}
	}
	return matches[0]
}

func imsaApplyOfficialMecRound(
	doc *imsaMecOfficialFile,
	code string,
	buckets map[string]*classCarAcc,
	getAcc func(cls, car string) *classCarAcc,
) {
	if doc == nil || !imsaIsMecRound(code) {
		return
	}
	code = strings.TrimSpace(code)
	for cls, cars := range doc.Classes {
		cls = strings.TrimSpace(cls)
		for car, rounds := range cars {
			pts, ok := rounds[code]
			if !ok || pts == 0 {
				continue
			}
			a := imsaFindMecAcc(buckets, cls, car, getAcc)
			a.mecPoints += pts
			addRoundPoints(a.mecRoundPoints, code, pts)
		}
	}
}

// imsaMecPointsForClassPos awards Michelin Endurance Cup points by class position
// at each scoring interval (1→5, 2→4, 3→3, 4+ classified→2). Used when an
// official PDF has not yet been seeded for a round (e.g. Petit Le Mans).
func imsaMecPointsForClassPos(classPos int) float64 {
	switch {
	case classPos == 1:
		return 5
	case classPos == 2:
		return 4
	case classPos == 3:
		return 3
	case classPos >= 4:
		return 2
	default:
		return 0
	}
}

func imsaMecClassPosFromRow(headers []string, row []string) int {
	if row == nil {
		return 0
	}
	istat := firstColIndex(headers, "STATUS", "Status")
	if istat >= 0 && istat < len(row) {
		st := strings.ToUpper(strings.TrimSpace(row[istat]))
		if strings.Contains(st, "NOT RUNNING") || strings.Contains(st, "DNS") ||
			strings.Contains(st, "WD") || strings.Contains(st, "OUT") {
			return 0
		}
	}
	icp := firstColIndex(headers, "CLASS POS", "Class Pos")
	if icp < 0 || icp >= len(row) {
		return 0
	}
	raw := strings.TrimSpace(row[icp])
	if raw == "" {
		return 0
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0
	}
	return n
}

func imsaMecSessionsForEvent(detail *EventDetailJSON) []EventTableSession {
	if detail == nil {
		return nil
	}
	var out []EventTableSession
	if mec, ok := detail.Tables["mec"]; ok && len(mec.Sessions) > 0 {
		out = append(out, mec.Sessions...)
	}
	hasFinish := false
	for _, s := range out {
		if strings.EqualFold(strings.TrimSpace(s.Title), "finish") {
			hasFinish = true
			break
		}
	}
	if !hasFinish {
		if race, ok := detail.Tables["race"]; ok && len(race.Headers) > 0 && len(race.Rows) > 0 {
			out = append(out, EventTableSession{
				Title:   "Finish",
				Headers: race.Headers,
				Rows:    race.Rows,
			})
		}
	}
	return out
}

func imsaAccumulateMecFromEvent(
	detail *EventDetailJSON,
	code string,
	entryClass map[string]string,
	getAcc func(cls, car string) *classCarAcc,
) {
	if !imsaIsMecRound(code) || detail == nil {
		return
	}
	sessions := imsaMecSessionsForEvent(detail)
	if len(sessions) == 0 {
		return
	}
	for _, sess := range sessions {
		if len(sess.Headers) == 0 || len(sess.Rows) == 0 {
			continue
		}
		icar := firstColIndex(sess.Headers, "CAR NO", "Car No", "No.", "No", "#", "Car")
		icls := firstColIndex(sess.Headers, "CLASS", "Class")
		if icar < 0 {
			continue
		}
		for _, row := range sess.Rows {
			if icar >= len(row) {
				continue
			}
			eventCar := strings.TrimSpace(row[icar])
			if eventCar == "" {
				continue
			}
			cls := ""
			if icls >= 0 && icls < len(row) {
				cls = strings.TrimSpace(row[icls])
			}
			if ec, ok := entryClass[eventCar]; ok && ec != "" {
				cls = normalizeImsaClassFromEntry(ec, cls)
			}
			if cls == "" {
				continue
			}
			pos := imsaMecClassPosFromRow(sess.Headers, row)
			if pos <= 0 {
				continue
			}
			pts := imsaMecPointsForClassPos(pos)
			if pts <= 0 {
				continue
			}
			a := getAcc(cls, eventCar)
			a.mecPoints += pts
			addRoundPoints(a.mecRoundPoints, code, pts)
		}
	}
}
