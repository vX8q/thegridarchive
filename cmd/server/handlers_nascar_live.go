package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/vX8q/tga/internal/livesync"
)

func handleLiveBoards(w http.ResponseWriter, _ *http.Request, dataDir string) {
	boards := livesync.CollectLiveBoards(dataDir, livesync.LiveBoardLeaderLimit)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"fetched_at": time.Now().UTC(),
		"boards":     boards,
	})
}
