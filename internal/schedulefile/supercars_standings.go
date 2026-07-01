package schedulefile

import (
	"regexp"
	"strconv"
	"strings"
)

var supercarsRaceSuffixRe = regexp.MustCompile(`(?i)\s+Race\s+\d+\s*$`)

func supercarsStandingsEventName(name string) string {
	return strings.TrimSpace(supercarsRaceSuffixRe.ReplaceAllString(strings.TrimSpace(name), ""))
}

// supercarsStandingsRaceCode returns venue prefix + race index within the weekend (SMP1–3, MLB1–4, …).
func supercarsStandingsRaceCode(ev EventJSON, raceInWeekend int) string {
	prefix := supercarsStandingsVenuePrefix(ev)
	if prefix == "" {
		prefix = "R"
	}
	if raceInWeekend < 1 {
		raceInWeekend = 1
	}
	return prefix + strconv.Itoa(raceInWeekend)
}

// EnrichSupercarsStandingsFromTeams fills team/manufacturer from teams.json by car number.
// Driver names come from race results (so weekend substitutes keep their own row).
func EnrichSupercarsStandingsFromTeams(dataDir string, data *StandingsData) {
	if data == nil || len(data.Rows) == 0 {
		return
	}
	teams, err := LoadTeams(dataDir, "SUPERCARS")
	if err != nil || teams == nil {
		return
	}
	byCar := make(map[string]TeamJSON)
	for _, tm := range teams.Teams {
		car := SupercarsCarToCanonical(strings.TrimSpace(tm.Number))
		if car == "" {
			continue
		}
		byCar[car] = tm
	}
	for i := range data.Rows {
		car := SupercarsCarToCanonical(strings.TrimSpace(data.Rows[i].Car))
		tm, ok := byCar[car]
		if !ok {
			continue
		}
		if team := strings.TrimSpace(tm.Team); team != "" && strings.TrimSpace(data.Rows[i].Team) == "" {
			data.Rows[i].Team = team
		}
		if manu := strings.TrimSpace(tm.Manufacturer); manu != "" && strings.TrimSpace(data.Rows[i].Manufacturer) == "" {
			data.Rows[i].Manufacturer = manu
		}
		data.Rows[i].Car = car
	}
}

func supercarsRaceOrderContains(order []string, code string) bool {
	for _, c := range order {
		if c == code {
			return true
		}
	}
	return false
}

func supercarsStandingsVenuePrefix(ev EventJSON) string {
	hay := strings.ToLower(strings.TrimSpace(ev.CircuitName) + " " + strings.TrimSpace(ev.Name) + " " + strings.TrimSpace(ev.Location))
	known := []struct {
		needle string
		code   string
	}{
		{"sydney motorsport", "SMP"},
		{"eastern creek", "SMP"},
		{"albert park", "MLB"},
		{"melbourne", "MLB"},
		{"taup", "TPO"},
		{"euromarque", "CHR"},
		{"christchurch", "CHR"},
		{"symmons plains", "TAS"},
		{"launceston", "TAS"},
		{"hidden valley", "DAR"},
		{"darwin", "DAR"},
		{"townsville", "TSV"},
		{"reid park", "TSV"},
		{"wanneroo", "PER"},
		{"neerabup", "PER"},
		{"queensland raceway", "IPS"},
		{"ipswich", "IPS"},
		{"the bend", "BEN"},
		{"tailem bend", "BEN"},
		{"mount panorama", "BAT"},
		{"bathurst", "BAT"},
		{"surfers paradise", "GC"},
		{"gold coast", "GC"},
		{"sandown", "SAN"},
		{"adelaide", "ADL"},
	}
	for _, k := range known {
		if strings.Contains(hay, k.needle) {
			return k.code
		}
	}
	tokens := strings.FieldsFunc(hay, func(r rune) bool {
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'))
	})
	stop := map[string]bool{
		"super": true, "sprint": true, "race": true, "cup": true, "series": true,
		"440": true, "500": true, "1000": true, "grand": true, "final": true,
	}
	var b strings.Builder
	for _, tok := range tokens {
		if tok == "" || stop[tok] || len(tok) < 2 {
			continue
		}
		b.WriteByte(tok[0])
		if b.Len() >= 3 {
			break
		}
	}
	if b.Len() == 0 {
		return ""
	}
	if b.Len() < 3 {
		for _, tok := range tokens {
			if len(tok) > 1 {
				b.WriteByte(tok[1])
				if b.Len() >= 3 {
					break
				}
			}
		}
	}
	return strings.ToUpper(b.String())
}
