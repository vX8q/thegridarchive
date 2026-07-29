package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/vX8q/tga/internal/schedulefile"
)

func loadEnrichedEventBody(dataDir, eventID string) ([]byte, error) {
	cacheKey := strings.ToLower(eventID)
	fileID := schedulefile.ResolveSupercarsHTTPFileID(dataDir, cacheKey)
	body, err := schedulefile.ReadEventDetailFileAtID(dataDir, fileID)
	if err != nil {
		return nil, err
	}
	seriesID := extractSeriesIDFromEventID(eventID)
	if enriched, err := schedulefile.EnrichPSCEvent(body, seriesID); err == nil {
		body = enriched
	}
	if enriched, err := schedulefile.EnrichSupercarsEvent(body, dataDir, seriesID); err == nil {
		body = enriched
	}
	if enriched, err := schedulefile.EnrichStockCarEventTeamNames(body, dataDir, seriesID); err == nil {
		body = enriched
	}
	body = schedulefile.PatchSupercarsEventIDFromRequest(body, eventID, fileID)
	return body, nil
}

func buildEventSummary(dataDir, eventID string) schedulefile.LastResultsSummary {
	body, err := loadEnrichedEventBody(dataDir, eventID)
	if err != nil {
		s := schedulefile.LastResultsSummary{
			ID:       strings.ToUpper(strings.TrimSpace(eventID)),
			Winners:  []schedulefile.LastResultsWinner{},
			NotFound: os.IsNotExist(err),
		}
		return s
	}
	seriesID := extractSeriesIDFromEventID(eventID)
	return schedulefile.BuildLastResultsSummaryFromBytes(body, eventID, seriesID)
}

func handleEventSummary(w http.ResponseWriter, _ *http.Request, dataDir, eventID string) {
	eventID = strings.TrimSpace(eventID)
	if eventID == "" || !ValidEventOrSeriesID(eventID) {
		writeError(w, http.StatusBadRequest, "invalid event id")
		return
	}
	sum := buildEventSummary(dataDir, eventID)
	if sum.NotFound {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, max-age=30")
	_ = json.NewEncoder(w).Encode(sum)
}

func handleEventSummaries(w http.ResponseWriter, r *http.Request, dataDir string) {
	raw := strings.TrimSpace(r.URL.Query().Get("ids"))
	if raw == "" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]schedulefile.LastResultsSummary{})
		return
	}
	parts := strings.Split(raw, ",")
	out := make(map[string]schedulefile.LastResultsSummary, len(parts))
	for _, p := range parts {
		id := strings.TrimSpace(p)
		if id == "" {
			continue
		}
		if !ValidEventOrSeriesID(id) {
			continue
		}
		sum := buildEventSummary(dataDir, id)
		key := strings.ToUpper(id)
		out[key] = sum
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, max-age=30")
	if err := json.NewEncoder(w).Encode(out); err != nil {
		slog.Error("encode event summaries failed", "err", err, "trace_id", TraceID(r.Context()))
	}
}
