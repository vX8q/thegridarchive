package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/driverutil"
	"github.com/vX8q/tga/internal/schedulefile"
)

// teamProfile is an organization (entrant) canon — not a marque and not a
// per-season commercial name. display_name_by_season is UI-only; resolve of
// raw entry_list strings goes through team_profile_redirects.json (built from
// ALL distinct team/constructor strings + curated aliases).
type teamProfile struct {
	Kind                string            `json:"kind"`
	CanonicalName       string            `json:"canonical_name"`
	SeriesIDs           []string          `json:"series_ids"`
	DisplayNameBySeason map[string]string `json:"display_name_by_season"`
	Founded             string            `json:"founded"`
	Headquarters        string            `json:"headquarters"`
	Lineage             string            `json:"lineage"`
	Owner               string            `json:"owner"`
	President           string            `json:"president"`
	TeamPrincipal       string            `json:"team_principal"`
	Staff               []teamStaffMember `json:"staff,omitempty"`
}

type teamStaffMember struct {
	Name    string   `json:"name"`
	Role    string   `json:"role"`
	Group   string   `json:"group"`
	Seasons []string `json:"seasons,omitempty"` // empty = all seasons (legacy)
}

type teamSeriesRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func championshipNameByLooseID(id string) string {
	id = strings.TrimSpace(id)
	if id == "" {
		return ""
	}
	for _, c := range config.Championships {
		if strings.EqualFold(c.ID, id) {
			return c.Name
		}
	}
	return id
}

func teamSeriesRefs(ids []string) []teamSeriesRef {
	out := make([]teamSeriesRef, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		out = append(out, teamSeriesRef{
			ID:   id,
			Name: championshipNameByLooseID(id),
		})
	}
	return out
}

var (
	teamProfilesMu    sync.RWMutex
	teamProfiles      map[string]teamProfile
	teamProfilesErr   error
	teamProfilesMTime time.Time

	teamProfileRedirectsMu    sync.RWMutex
	teamProfileRedirects      map[string]string
	teamProfileRedirectsErr   error
	teamProfileRedirectsMTime time.Time
)

func loadTeamProfiles(dataDir string) (map[string]teamProfile, error) {
	path := filepath.Join(dataDir, "team_profiles.json")
	fi, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			teamProfilesMu.Lock()
			teamProfiles = map[string]teamProfile{}
			teamProfilesErr = nil
			teamProfilesMTime = time.Time{}
			teamProfilesMu.Unlock()
			return map[string]teamProfile{}, nil
		}
		teamProfilesMu.RLock()
		defer teamProfilesMu.RUnlock()
		return teamProfiles, statErr
	}
	modTime := fi.ModTime()
	teamProfilesMu.RLock()
	cached := teamProfiles
	cachedErr := teamProfilesErr
	cachedMTime := teamProfilesMTime
	teamProfilesMu.RUnlock()
	if cached != nil && cachedErr == nil && modTime.Equal(cachedMTime) {
		return cached, nil
	}

	b, err := os.ReadFile(path) //nolint:gosec
	teamProfilesMu.Lock()
	defer teamProfilesMu.Unlock()
	if err != nil {
		teamProfilesErr = err
		return teamProfiles, err
	}
	var parsed map[string]teamProfile
	if err := json.Unmarshal(b, &parsed); err != nil {
		teamProfilesErr = err
		return teamProfiles, err
	}
	if parsed == nil {
		parsed = map[string]teamProfile{}
	}
	teamProfiles = parsed
	teamProfilesErr = nil
	teamProfilesMTime = modTime
	return teamProfiles, nil
}

func loadTeamProfileRedirects(dataDir string) (map[string]string, error) {
	path := filepath.Join(dataDir, "team_profile_redirects.json")
	fi, statErr := os.Stat(path)
	if statErr != nil {
		if os.IsNotExist(statErr) {
			teamProfileRedirectsMu.Lock()
			teamProfileRedirects = map[string]string{}
			teamProfileRedirectsErr = nil
			teamProfileRedirectsMTime = time.Time{}
			teamProfileRedirectsMu.Unlock()
			return map[string]string{}, nil
		}
		teamProfileRedirectsMu.RLock()
		defer teamProfileRedirectsMu.RUnlock()
		return teamProfileRedirects, statErr
	}
	modTime := fi.ModTime()
	teamProfileRedirectsMu.RLock()
	cached := teamProfileRedirects
	cachedErr := teamProfileRedirectsErr
	cachedMTime := teamProfileRedirectsMTime
	teamProfileRedirectsMu.RUnlock()
	if cached != nil && cachedErr == nil && modTime.Equal(cachedMTime) {
		return cached, nil
	}

	b, err := os.ReadFile(path) //nolint:gosec
	teamProfileRedirectsMu.Lock()
	defer teamProfileRedirectsMu.Unlock()
	if err != nil {
		teamProfileRedirectsErr = err
		return teamProfileRedirects, err
	}
	var parsed map[string]string
	if err := json.Unmarshal(b, &parsed); err != nil {
		teamProfileRedirectsErr = err
		return teamProfileRedirects, err
	}
	if parsed == nil {
		parsed = map[string]string{}
	}
	teamProfileRedirects = parsed
	teamProfileRedirectsErr = nil
	teamProfileRedirectsMTime = modTime
	return teamProfileRedirects, nil
}

// resolveTeamProfileSlug follows one-hop redirects then returns the slug if a
// profile exists (same contract as resolveDriverProfileSlug).
func resolveTeamProfileSlug(slugKey string, profiles map[string]teamProfile, redirects map[string]string) string {
	slugKey = strings.TrimSpace(strings.ToLower(slugKey))
	if slugKey == "" {
		return ""
	}
	if redirects != nil {
		if target := strings.TrimSpace(strings.ToLower(redirects[slugKey])); target != "" {
			slugKey = target
		}
	}
	if profiles != nil {
		if _, ok := profiles[slugKey]; ok {
			return slugKey
		}
	}
	return slugKey
}

func teamDisplayNameForSeason(p teamProfile, seriesID, season string) string {
	key := strings.TrimSpace(strings.ToLower(seriesID)) + "|" + strings.TrimSpace(season)
	if p.DisplayNameBySeason != nil {
		if d := strings.TrimSpace(p.DisplayNameBySeason[key]); d != "" {
			return d
		}
		// Fall back to any season for that series
		prefix := strings.TrimSpace(strings.ToLower(seriesID)) + "|"
		for k, v := range p.DisplayNameBySeason {
			if strings.HasPrefix(k, prefix) && strings.TrimSpace(v) != "" {
				return strings.TrimSpace(v)
			}
		}
	}
	return strings.TrimSpace(p.CanonicalName)
}

func handleTeamProfileRedirects(w http.ResponseWriter, _ *http.Request, dataDir string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	redirects, err := loadTeamProfileRedirects(dataDir)
	if err != nil {
		redirects = map[string]string{}
	}
	if redirects == nil {
		redirects = map[string]string{}
	}
	_ = jsonMarshalTo(w, redirects)
}

// handleTeamBySlug serves GET /api/team/{slug} — canon meta for step 1
// (roster/results aggregation is a later step).
func handleTeamBySlug(w http.ResponseWriter, r *http.Request, dataDir string) {
	slug := strings.TrimPrefix(r.URL.Path, "/api/team/")
	slug = strings.TrimSpace(strings.TrimRight(slug, "/"))
	if slug == "" || strings.Contains(slug, "/") {
		writeError(w, http.StatusBadRequest, "missing team slug")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")

	profiles, _ := loadTeamProfiles(dataDir)
	redirects, _ := loadTeamProfileRedirects(dataDir)
	slugKey := resolveTeamProfileSlug(driverutil.Slug(slug), profiles, redirects)
	p, ok := profiles[slugKey]
	if !ok {
		http.NotFound(w, r)
		return
	}

	seasonQ := strings.TrimSpace(r.URL.Query().Get("season"))
	seriesID := strings.TrimSpace(r.URL.Query().Get("series"))
	display := strings.TrimSpace(p.CanonicalName)
	if seasonQ != "" && seriesID != "" {
		display = teamDisplayNameForSeason(p, seriesID, seasonQ)
	} else if seasonQ != "" && len(p.SeriesIDs) == 1 {
		display = teamDisplayNameForSeason(p, p.SeriesIDs[0], seasonQ)
	}

	careerSeason := "" // always build full career; filter for season_results
	results, roster, aggErr := schedulefile.BuildTeamCareerFromEvents(dataDir, slugKey, careerSeason, seriesID, redirects)
	if aggErr != nil {
		results, roster = nil, nil
	}
	avail := schedulefile.TeamAvailableSeasons(results, roster)
	season := seasonQ
	if season == "" {
		season = config.CurrentSeason
		if len(avail) > 0 {
			// Prefer current season if present, else newest
			found := false
			for _, s := range avail {
				if s == season {
					found = true
					break
				}
			}
			if !found {
				season = avail[0]
			}
		}
	}
	if seasonQ == "" && seriesID == "" && len(p.SeriesIDs) > 0 {
		display = teamDisplayNameForSeason(p, p.SeriesIDs[0], season)
	}

	seasonResults := schedulefile.FilterTeamSeasonResults(results, season)
	seasonRoster := schedulefile.FilterTeamRosterBySeason(roster, season)

	resp := map[string]interface{}{
		"canonical_slug":         slugKey,
		"canonical_name":         strings.TrimSpace(p.CanonicalName),
		"display_name":           display,
		"kind":                   strings.TrimSpace(p.Kind),
		"series_ids":             p.SeriesIDs,
		"series":                 teamSeriesRefs(p.SeriesIDs),
		"display_name_by_season": p.DisplayNameBySeason,
		"logo_url":               "/api/team-logo/" + slugKey,
		"has_logo":               teamHasRealLogo(dataDir, slugKey),
		"season":                 season,
		"available_seasons":      avail,
		"season_roster":          seasonRoster,
		"season_results":         seasonResults,
		"career_results":         results,
		"career_roster":          roster,
	}
	attachTeamOrgMetadata(resp, p)
	_ = jsonMarshalTo(w, resp)
}

func attachTeamOrgMetadata(resp map[string]interface{}, p teamProfile) {
	if v := strings.TrimSpace(p.Founded); v != "" {
		resp["founded"] = v
	}
	if v := strings.TrimSpace(p.Headquarters); v != "" {
		resp["headquarters"] = v
	}
	if v := strings.TrimSpace(p.Lineage); v != "" {
		resp["lineage"] = v
	}
	if v := strings.TrimSpace(p.Owner); v != "" {
		resp["owner"] = v
	}
	if v := strings.TrimSpace(p.President); v != "" {
		resp["president"] = v
	}
	if v := strings.TrimSpace(p.TeamPrincipal); v != "" {
		resp["team_principal"] = v
	}
	if staff := resolveTeamStaff(p); len(staff) > 0 {
		resp["staff"] = staff
		season, _ := resp["season"].(string)
		filtered := filterTeamStaffBySeason(staff, season)
		if len(filtered) > 0 {
			resp["season_staff"] = filtered
			for _, m := range filtered {
				if strings.Contains(strings.ToLower(m.Role), "team principal") {
					resp["team_principal"] = m.Name
					break
				}
			}
		}
	}
}

func normalizeStaffGroup(g string) string {
	switch strings.ToLower(strings.TrimSpace(g)) {
	case "management", "sporting", "technical", "operations":
		return strings.ToLower(strings.TrimSpace(g))
	default:
		return "other"
	}
}

func normalizeStaffSeasons(seasons []string) []string {
	if len(seasons) == 0 {
		return nil
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(seasons))
	for _, y := range seasons {
		y = strings.TrimSpace(y)
		if y == "" || seen[y] {
			continue
		}
		seen[y] = true
		out = append(out, y)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func staffMemberInSeason(s teamStaffMember, season string) bool {
	season = strings.TrimSpace(season)
	if season == "" || len(s.Seasons) == 0 {
		return true
	}
	for _, y := range s.Seasons {
		if strings.TrimSpace(y) == season {
			return true
		}
	}
	return false
}

func filterTeamStaffBySeason(staff []teamStaffMember, season string) []teamStaffMember {
	season = strings.TrimSpace(season)
	if season == "" || len(staff) == 0 {
		return staff
	}
	out := make([]teamStaffMember, 0, len(staff))
	for _, s := range staff {
		if staffMemberInSeason(s, season) {
			out = append(out, s)
		}
	}
	return out
}

func resolveTeamStaff(p teamProfile) []teamStaffMember {
	out := make([]teamStaffMember, 0, len(p.Staff)+3)
	seen := map[string]bool{}
	add := func(name, role, group string, seasons []string) {
		name = strings.TrimSpace(name)
		role = strings.TrimSpace(role)
		if name == "" || role == "" {
			return
		}
		seasons = normalizeStaffSeasons(seasons)
		key := strings.ToLower(name) + "|" + strings.ToLower(role) + "|" + strings.Join(seasons, ",")
		if seen[key] {
			return
		}
		seen[key] = true
		out = append(out, teamStaffMember{
			Name:    name,
			Role:    role,
			Group:   normalizeStaffGroup(group),
			Seasons: seasons,
		})
	}
	for _, s := range p.Staff {
		add(s.Name, s.Role, s.Group, s.Seasons)
	}
	if len(out) > 0 {
		return out
	}
	canon := strings.TrimSpace(p.CanonicalName)
	owner := strings.TrimSpace(p.Owner)
	if owner != "" && !strings.EqualFold(owner, canon) {
		add(owner, "Owner", "management", nil)
	}
	add(p.President, "President", "management", nil)
	add(p.TeamPrincipal, "Team Principal", "management", nil)
	return out
}

func teamHasRealLogo(dataDir, slug string) bool {
	logos, err := loadTeamLogos(dataDir)
	if err != nil || logos == nil {
		return false
	}
	return strings.TrimSpace(logos[teamSlug(slug)]) != ""
}
