package schedulefile

import "strings"

// dtmTeamChampionshipCanonByFoldKey maps operational team names from race tables
// to the official teams' championship entry (e.g. Mann-Filter + Ravenol → Winward Racing).
func dtmTeamChampionshipCanonByFoldKey(dataDir, seriesID string) map[string]string {
	out := make(map[string]string)
	teams, err := LoadTeams(dataDir, seriesID)
	if err != nil || teams == nil {
		return out
	}
	for _, t := range teams.Teams {
		opTeam := strings.TrimSpace(t.Team)
		champTeam := strings.TrimSpace(t.TeamsChampionship)
		if opTeam == "" || champTeam == "" {
			continue
		}
		key := foldStockCarTeamKey(opTeam)
		if key == "" {
			continue
		}
		out[key] = champTeam
	}
	return out
}

// teamCanonByFoldKeyForStats returns team-name canonicalization for Team Stats aggregation.
func teamCanonByFoldKeyForStats(dataDir, seriesID string) map[string]string {
	if isStockCarTeamStatsSeries(seriesID) {
		return stockCarTeamCanonByFoldKey(dataDir, seriesID)
	}
	if strings.EqualFold(seriesID, "DTM") {
		return dtmTeamChampionshipCanonByFoldKey(dataDir, seriesID)
	}
	return nil
}
