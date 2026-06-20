package main

import (
	"encoding/json"
	"net/http"

	"github.com/vX8q/tga/internal/livesync"
	"github.com/vX8q/tga/internal/store"
)

// handleLiveDebug is a temporary endpoint for the /live debug page (raw live sources + live.json).
func handleLiveDebug(w http.ResponseWriter, r *http.Request, dataDir string, st store.Store) {
	report := livesync.CollectDebug(dataDir)
	served := filterLiveEventIDs(r.Context(), st, report.LiveJSON)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"fetched_at":         report.FetchedAt,
		"live_json":          report.LiveJSON,
		"live_events_served": served,
		"nascar":             report.NASCAR,
		"openf1":             report.OpenF1,
		"wec":                report.WEC,
		"super_formula":      report.SuperFormula,
		"note":               "Temporary debug payload for /live page. Remove when live sync is stable.",
	})
}
