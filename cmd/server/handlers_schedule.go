package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/vX8q/tga/config"
	"github.com/vX8q/tga/internal/schedulefile"
	"github.com/vX8q/tga/internal/store"
)

type seriesEventWithDetail struct {
	schedulefile.EventJSON
	HasDetail bool `json:"has_detail"`
}

func filterEventsBySeason(events []schedulefile.EventJSON, season string) []schedulefile.EventJSON {
	if season == "" {
		return events
	}
	out := make([]schedulefile.EventJSON, 0, len(events))
	for _, e := range events {
		if e.Season == season {
			out = append(out, e)
		}
	}
	return out
}

func enrichSeriesEvents(dataDir, dataSeriesID string, events []schedulefile.EventJSON, fileSet map[string]struct{}) []seriesEventWithDetail {
	out := make([]seriesEventWithDetail, len(events))
	for i, e := range events {
		if e.SeriesID == "" {
			e.SeriesID = dataSeriesID
		}
		out[i] = seriesEventWithDetail{
			EventJSON: e,
			HasDetail: schedulefile.EventHasDetail(dataDir, fileSet, e.ID),
		}
	}
	return out
}

func handleSeriesEvents(w http.ResponseWriter, r *http.Request, dataDir, dataSeriesID string, st store.Store, season string) {
	// 1) Read from JSON first — source of truth for the schedule (editable data/schedules/*.json).
	events, err := schedulefile.LoadEvents(dataDir, dataSeriesID)
	if err == nil && len(events) > 0 {
		fileSet := schedulefile.EventDetailFileSet(dataDir)
		filtered := filterEventsBySeason(events, season)
		enriched := enrichSeriesEvents(dataDir, dataSeriesID, filtered, fileSet)
		_ = json.NewEncoder(w).Encode(enriched)
		return
	}

	// 2) Fallback: if JSON is empty or missing, read from the DB.
	if st != nil {
		ctx := r.Context()
		dbSeriesID := strings.ToUpper(dataSeriesID)
		dbEvents, err := st.ListEvents(ctx, dbSeriesID, season)
		if err != nil {
			slog.Error("list events failed",
				"series", dbSeriesID,
				"season", season,
				"err", err,
				"trace_id", TraceID(ctx),
			)
			writeError(w, http.StatusInternalServerError, "failed to list events")
			return
		}
		if len(dbEvents) > 0 {
			fileSet := schedulefile.EventDetailFileSet(dataDir)
			enriched := make([]seriesEventWithDetail, len(dbEvents))
			for i, e := range dbEvents {
				ev := schedulefile.EventJSON{
					ID:          e.ID,
					SeriesID:    e.SeriesID,
					Season:      e.Season,
					Name:        e.Name,
					Location:    e.Location,
					CircuitName: e.CircuitName,
					StartDate:   e.StartDate.Format("2006-01-02"),
					EndDate:     e.EndDate.Format("2006-01-02"),
					TimeEST:     e.TimeEST,
					TimeMSK:     e.TimeMSK,
				}
				enriched[i] = seriesEventWithDetail{
					EventJSON: ev,
					HasDetail: schedulefile.EventHasDetail(dataDir, fileSet, ev.ID),
				}
			}
			_ = json.NewEncoder(w).Encode(enriched)
			return
		}
	}

	if events == nil {
		events = []schedulefile.EventJSON{}
	}
	fileSet := schedulefile.EventDetailFileSet(dataDir)
	enriched := enrichSeriesEvents(dataDir, dataSeriesID, events, fileSet)
	_ = json.NewEncoder(w).Encode(enriched)
}

func handleAggregatedSchedule(w http.ResponseWriter, r *http.Request, dataDir string) {
	w.Header().Set("Content-Type", "application/json")

	season := strings.TrimSpace(r.URL.Query().Get("season"))
	if season == "" {
		season = config.CurrentSeason
	} else if _, err := strconv.Atoi(season); err != nil {
		writeError(w, http.StatusBadRequest, "invalid season")
		return
	}

	cacheKey := "schedule/all/" + season
	sourceMtime := schedulefile.AggregatedScheduleMaxMtime(dataDir)
	if tryWriteSeriesJSONCache(w, cacheKey, sourceMtime) {
		return
	}

	fileSet := schedulefile.EventDetailFileSet(dataDir)
	seriesNames := make(map[string]string, len(config.Championships))
	var all []seriesEventWithDetail

	for _, c := range config.Championships {
		seriesNames[c.ID] = c.Name
		events, err := schedulefile.LoadEvents(dataDir, c.ID)
		if err != nil || len(events) == 0 {
			continue
		}
		filtered := filterEventsBySeason(events, season)
		all = append(all, enrichSeriesEvents(dataDir, c.ID, filtered, fileSet)...)
	}

	payload := map[string]any{
		"season": season,
		"events": all,
		"series": seriesNames,
	}
	writeSeriesJSONCached(w, cacheKey, sourceMtime, payload)
}
