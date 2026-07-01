package schedulefile

import (
	"strings"
	"unicode"
)

// foldStockCarTeamKey folds team names for stats aggregation so spelling variants
// (hyphens, en-dashes, spaces, "GreenLight" vs "Green Light") map to one key.
func foldStockCarTeamKey(team string) string {
	s := strings.TrimSpace(team)
	if s == "" || s == "—" {
		return ""
	}
	s = strings.ToLower(s)
	replacer := strings.NewReplacer(
		"\u2013", "", // en-dash
		"\u2014", "", // em-dash
		"-", "",
		"'", "",
		".", "",
		",", "",
		"&", "",
	)
	s = replacer.Replace(s)
	var b strings.Builder
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// stockCarTeamCanonByFoldKey builds fold-key → canonical team name from teams JSON.
func stockCarTeamCanonByFoldKey(dataDir, seriesID string) map[string]string {
	out := make(map[string]string)
	teams, err := LoadTeams(dataDir, seriesID)
	if err != nil || teams == nil {
		return out
	}
	for _, t := range teams.Teams {
		name := strings.TrimSpace(t.Team)
		if name == "" {
			continue
		}
		key := foldStockCarTeamKey(name)
		if key == "" {
			continue
		}
		if _, ok := out[key]; !ok {
			out[key] = name
		}
	}
	return out
}

// canonicalStockCarTeamName returns the canonical display name for a team string.
// Unknown variants are registered under their fold key so duplicates still merge.
func canonicalStockCarTeamName(raw string, byKey map[string]string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "—" {
		return "—"
	}
	key := foldStockCarTeamKey(raw)
	if key == "" {
		return raw
	}
	if canon, ok := byKey[key]; ok && strings.TrimSpace(canon) != "" {
		return canon
	}
	byKey[key] = raw
	return raw
}

func isStockCarTeamStatsSeries(seriesID string) bool {
	switch strings.ToUpper(strings.TrimSpace(seriesID)) {
	case "NASCAR_CUP", "NOAPS", "NASCAR_TRUCK", "ARCA", "NASCAR_MODIFIED":
		return true
	default:
		return false
	}
}
