package schedulefile

import (
	"strings"
)

type q2q3Count struct {
	Q2, Q3 int
	// avg_qualifying: total qualifying position and appearance count.
	SumPos float64
	Count  int
	// poles: how many times qualifying position was 1.
	Poles int
}

// loadF1QualifyingQ2Q3Passes reads F1 event JSON for season and counts Q2/Q3 passes per driver.
func loadF1QualifyingQ2Q3Passes(dataDir, season string) (map[string]q2q3Count, error) {
	out := make(map[string]q2q3Count)

	events, err := LoadEvents(dataDir, "F1")
	if err != nil {
		return nil, err
	}
	for _, ev := range events {
		if season != "" && strings.TrimSpace(ev.Season) != strings.TrimSpace(season) {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || detail.Tables == nil {
			continue
		}
		qual, ok := detail.Tables["qualifying"]
		if !ok {
			continue
		}

		var headers []string
		var rows [][]string
		if len(qual.Headers) > 0 && len(qual.Rows) > 0 {
			headers = qual.Headers
			rows = qual.Rows
		} else if len(qual.Sessions) > 0 {
			for _, sess := range qual.Sessions {
				cDriver := firstColIndex(sess.Headers, "Driver")
				cQ2 := firstColIndex(sess.Headers, "Q2")
				cQ3 := firstColIndex(sess.Headers, "Q3")
				cPos := firstColIndex(sess.Headers, "Pos", "Pos.", "P")
				if cDriver >= 0 && cQ2 >= 0 && cQ3 >= 0 && cPos >= 0 && len(sess.Rows) > 0 {
					headers = sess.Headers
					rows = sess.Rows
					break
				}
			}
		}
		if len(headers) == 0 || len(rows) == 0 {
			continue
		}

		colDriver := firstColIndex(headers, "Driver")
		colQ2 := firstColIndex(headers, "Q2")
		colQ3 := firstColIndex(headers, "Q3")
		colPos := firstColIndex(headers, "Pos", "Pos.", "P")
		if colDriver < 0 || colQ2 < 0 || colQ3 < 0 || colPos < 0 {
			continue
		}

		for _, row := range rows {
			driver := valueAt(row, colDriver)
			if driver == "" {
				continue
			}
			key := strings.TrimSpace(strings.ToLower(driver))
			v := out[key]
			q2Val := strings.TrimSpace(strings.ToUpper(valueAt(row, colQ2)))
			q3Val := strings.TrimSpace(strings.ToUpper(valueAt(row, colQ3)))
			if q2Val != "" && q2Val != "N/A" {
				v.Q2++
			}
			if q3Val != "" && q3Val != "N/A" && q3Val != "NO TIME" {
				v.Q3++
			}
			if p := atoiSafe(valueAt(row, colPos)); p > 0 {
				v.SumPos += float64(p)
				v.Count++
				if p == 1 {
					v.Poles++
				}
			}
			out[key] = v
		}
	}
	return out, nil
}
