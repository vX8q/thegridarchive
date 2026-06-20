// sync-wec-live polls the ECM WEC live JSON (storage.googleapis.com/ecm-prod/live/WEC/data.json)
// and updates data/live.json for WEC. Does not overwrite other live.json entries.
//
// Run: go run ./cmd/sync-wec-live -data-dir=./data
package main

import (
	"flag"
	"log"

	"github.com/vX8q/tga/internal/livesync"
)

func main() {
	dataDir := flag.String("data-dir", "data", "каталог data (schedules, live.json)")
	flag.Parse()

	if err := livesync.SyncWEC(*dataDir); err != nil {
		log.Fatalf("sync-wec-live: %v", err)
	}
}
