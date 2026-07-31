// export-teams-from-events builds/refreshes data/teams/{series}.json teams[] from
// 2026 event entry_lists via EnrichTeamsRoundsFromEvents (same as /api/.../teams).
// Preserves technical_spec / car_models / engines / homologation when present.
//
// Usage:
//
//	go run ./cmd/export-teams-from-events -write
//	go run ./cmd/export-teams-from-events -series f4_it,psc -write
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/vX8q/tga/internal/schedulefile"
)

func main() {
	dataDir := flag.String("data", "data", "data directory")
	season := flag.String("season", "2026", "season year")
	seriesFlag := flag.String("series", "", "comma-separated series ids (default: priority set)")
	write := flag.Bool("write", false, "write teams JSON files")
	flag.Parse()

	seriesList := []string{
		"f4_it", "psc", "frec",
		"gtwce_end", "gtwce_sprint", "elms", "super_gt", "wec",
		"arca", "nascar_modified",
		"nascar_cup", "noaps", "nascar_truck",
	}
	if strings.TrimSpace(*seriesFlag) != "" {
		seriesList = nil
		for _, s := range strings.Split(*seriesFlag, ",") {
			s = strings.TrimSpace(strings.ToLower(s))
			if s != "" {
				seriesList = append(seriesList, s)
			}
		}
	}

	rebuildFromScratch := map[string]bool{
		"f4_it": true, "psc": true,
		"gtwce_end": true, "gtwce_sprint": true,
		"elms": true, "super_gt": true, "wec": true,
	}
	appendMissingOnly := map[string]bool{
		"frec": true, "arca": true, "nascar_modified": true,
		"nascar_cup": true, "noaps": true, "nascar_truck": true,
	}
	keepFullTime := map[string]bool{
		"nascar_cup": true, "noaps": true, "nascar_truck": true,
		"arca": true, "nascar_modified": true,
	}

	for _, sid := range seriesList {
		existing, err := schedulefile.LoadTeams(*dataDir, sid)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s: load error: %v\n", sid, err)
			continue
		}
		if existing == nil {
			existing = &schedulefile.TeamsWithSpec{}
		}

		built := &schedulefile.TeamsWithSpec{}
		schedulefile.EnrichTeamsRoundsFromEvents(*dataDir, sid, *season, built)

		fmt.Printf("%s: curated=%d built_from_events=%d non_chartered=%d\n",
			sid, len(existing.Teams), len(built.Teams), len(existing.TeamsNonChartered))

		curatedFlat := append([]schedulefile.TeamJSON(nil), existing.Teams...)
		curatedFlat = append(curatedFlat, existing.TeamsNonChartered...)
		missing := missingFlatRows(curatedFlat, built.Teams)

		if !*write {
			if appendMissingOnly[sid] || rebuildFromScratch[sid] {
				fmt.Printf("  missing vs entry_list: %d\n", len(missing))
				for i, t := range missing {
					if i >= 12 {
						fmt.Printf("  ... +%d more\n", len(missing)-12)
						break
					}
					fmt.Printf("  + #%s %s (%s) rounds=%s\n", t.Number, t.Driver, t.Team, t.Rounds)
				}
			}
			continue
		}

		outPath := filepath.Join(*dataDir, "teams", sid+".json")

		if rebuildFromScratch[sid] {
			if len(built.Teams) == 0 {
				fmt.Printf("  skip write (nothing built — empty entry_lists?)\n")
				continue
			}
			out := &schedulefile.TeamsWithSpec{
				Teams:             built.Teams,
				CarModels:         existing.CarModels,
				TechnicalSpec:     existing.TechnicalSpec,
				Engines:           existing.Engines,
				Homologation:      existing.Homologation,
				TeamsNonChartered: existing.TeamsNonChartered,
			}
			if err := writeTeamsJSON(outPath, out, keepFullTime[sid]); err != nil {
				fmt.Fprintf(os.Stderr, "  write %s: %v\n", outPath, err)
				continue
			}
			fmt.Printf("  wrote %s (%d teams)\n", outPath, len(out.Teams))
			continue
		}

		if appendMissingOnly[sid] {
			if len(missing) == 0 {
				fmt.Printf("  skip write (complete)\n")
				continue
			}
			if err := appendTeamsRows(outPath, missing, keepFullTime[sid]); err != nil {
				fmt.Fprintf(os.Stderr, "  append %s: %v\n", outPath, err)
				continue
			}
			fmt.Printf("  appended %d rows -> %s\n", len(missing), outPath)
			continue
		}

		fmt.Printf("  skip write\n")
	}
}

func normCarNum(n string) string {
	n = strings.TrimSpace(n)
	if n == "" {
		return ""
	}
	trimmed := strings.TrimLeft(n, "0")
	if trimmed == "" {
		return "0"
	}
	return trimmed
}

func missingFlatRows(curated, built []schedulefile.TeamJSON) []schedulefile.TeamJSON {
	type key struct{ num, drv string }
	have := map[key]bool{}
	for _, t := range curated {
		drv := strings.TrimSpace(t.Driver)
		if drv == "" {
			continue
		}
		have[key{normCarNum(t.Number), schedulefile.DriverMatchKey(drv)}] = true
	}
	var missing []schedulefile.TeamJSON
	for _, t := range built {
		drv := strings.TrimSpace(t.Driver)
		if drv == "" {
			continue
		}
		k := key{normCarNum(t.Number), schedulefile.DriverMatchKey(drv)}
		if have[k] {
			continue
		}
		missing = append(missing, t)
		have[k] = true
	}
	return missing
}

func appendTeamsRows(path string, rows []schedulefile.TeamJSON, keepFullTime bool) error {
	path, err := safeTeamsJSONPath(path)
	if err != nil {
		return err
	}
	raw, err := os.ReadFile(path) //nolint:gosec // path constrained to data/teams/*.json via safeTeamsJSONPath
	if err != nil {
		return err
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		return err
	}
	var teams []map[string]any
	if tRaw, ok := doc["teams"]; ok {
		if err := json.Unmarshal(tRaw, &teams); err != nil {
			return err
		}
	}
	for _, t := range rows {
		teams = append(teams, teamToMap(t, keepFullTime))
	}
	b, err := json.Marshal(teams)
	if err != nil {
		return err
	}
	doc["teams"] = b

	// Re-encode whole document with indent, preserving other top-level keys.
	outDoc := map[string]any{}
	for k, v := range doc {
		var val any
		if err := json.Unmarshal(v, &val); err != nil {
			return err
		}
		outDoc[k] = val
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(outDoc); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o600) //nolint:gosec // local data/teams JSON rewrite tool
}

func writeTeamsJSON(path string, data *schedulefile.TeamsWithSpec, keepFullTime bool) error {
	path, err := safeTeamsJSONPath(path)
	if err != nil {
		return err
	}
	doc := map[string]any{}
	teams := make([]map[string]any, 0, len(data.Teams))
	for _, t := range data.Teams {
		teams = append(teams, teamToMap(t, keepFullTime))
	}
	doc["teams"] = teams
	if len(data.TeamsNonChartered) > 0 {
		nc := make([]map[string]any, 0, len(data.TeamsNonChartered))
		for _, t := range data.TeamsNonChartered {
			nc = append(nc, teamToMap(t, keepFullTime))
		}
		doc["teams_non_chartered"] = nc
	}
	if len(data.CarModels) > 0 {
		doc["car_models"] = data.CarModels
	}
	if len(data.TechnicalSpec) > 0 {
		doc["technical_spec"] = data.TechnicalSpec
	}
	if len(data.Engines) > 0 {
		doc["engines"] = data.Engines
	}
	if len(data.Homologation) > 0 {
		doc["homologation"] = data.Homologation
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(doc); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0o600) //nolint:gosec // local data/teams JSON rewrite tool
}

// safeTeamsJSONPath cleans path and requires a *.json basename (CLI write target under data/teams).
func safeTeamsJSONPath(path string) (string, error) {
	cleaned := filepath.Clean(path)
	base := filepath.Base(cleaned)
	if base == "." || base == ".." || !strings.HasSuffix(strings.ToLower(base), ".json") {
		return "", fmt.Errorf("refusing non-json teams path: %s", path)
	}
	return cleaned, nil
}

func teamToMap(t schedulefile.TeamJSON, keepFullTime bool) map[string]any {
	m := map[string]any{}
	put := func(k, v string) {
		if strings.TrimSpace(v) != "" {
			m[k] = v
		}
	}
	put("manufacturer", t.Manufacturer)
	put("team", t.Team)
	put("number", t.Number)
	put("driver", t.Driver)
	put("crew_chief", t.CrewChief)
	put("races", t.Races)
	put("driver_country", t.DriverCountry)
	put("class", t.Class)
	put("chassis", t.Chassis)
	put("rounds", t.Rounds)
	put("co_driver", t.CoDriver)
	put("co_rounds", t.CoRounds)
	put("model", t.Model)
	put("power_unit", t.PowerUnit)
	put("car", t.Car)
	put("status", t.Status)
	put("teams_championship", t.TeamsChampionship)
	put("ref", t.Ref)
	if len(t.Drivers) > 0 {
		m["drivers"] = t.Drivers
	}
	if len(t.DriverRounds) > 0 {
		m["driver_rounds"] = t.DriverRounds
	}
	if t.Rookie {
		m["rookie"] = true
	}
	if t.Guest {
		m["guest"] = true
	}
	if keepFullTime {
		m["full_time"] = t.FullTime
	}
	return m
}
