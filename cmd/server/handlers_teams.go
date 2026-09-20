package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
)

func loadSeriesTeamsForAPI(dataDir, dataSeriesID, season string) *schedulefile.TeamsWithSpec {
	if season == "" {
		season = config.CurrentSeason
	}
	cacheKey := "teams/" + strings.ToLower(dataSeriesID) + "/" + season
	sourceMtime := schedulefile.TeamsDataMaxMtime(dataDir, dataSeriesID, season)
	if body, ok := seriesResponseCache.Get(cacheKey, sourceMtime); ok {
		var data schedulefile.TeamsWithSpec
		if json.Unmarshal(body, &data) == nil {
			return &data
		}
	}
	data, err := schedulefile.LoadTeamsForSeason(dataDir, dataSeriesID, season)
	if err != nil {
		slog.Error("load teams failed", "series", dataSeriesID, "err", err)
		return &schedulefile.TeamsWithSpec{}
	}
	if data == nil {
		data = &schedulefile.TeamsWithSpec{}
	}
	schedulefile.EnrichTeamsRoundsFromEvents(dataDir, dataSeriesID, season, data)
	if body, mErr := json.Marshal(data); mErr == nil {
		seriesResponseCache.Set(cacheKey, sourceMtime, body)
	}
	return data
}

func handleAllSeriesTeams(w http.ResponseWriter, r *http.Request, dataDir string) {
	season := strings.TrimSpace(r.URL.Query().Get("season"))
	if season == "" {
		season = config.CurrentSeason
	}
	cacheKey := "teams/_all/" + season
	sourceMtime := schedulefile.AllSeriesTeamsMaxMtime(dataDir)
	if tryWriteSeriesJSONCache(w, cacheKey, sourceMtime) {
		return
	}

	type keyed struct {
		id   string
		data *schedulefile.TeamsWithSpec
	}
	n := len(config.Championships)
	ch := make(chan keyed, n)
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	seen := make(map[string]struct{}, n)
	for _, c := range config.Championships {
		id := config.DataSeriesID(c.ID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			ch <- keyed{id: id, data: loadSeriesTeamsForAPI(dataDir, id, season)}
		}(id)
	}
	go func() {
		wg.Wait()
		close(ch)
	}()
	bySeries := make(map[string]*schedulefile.TeamsWithSpec, n)
	for item := range ch {
		bySeries[strings.ToLower(item.id)] = item.data
	}
	writeSeriesJSONCached(w, cacheKey, sourceMtime, map[string]any{
		"season":    season,
		"by_series": bySeries,
	})
}
