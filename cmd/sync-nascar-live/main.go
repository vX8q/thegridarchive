// sync-nascar-live queries the official NASCAR API (feed.nascar.com), detects the
// current live race, and updates data/live.json for the LIVE badge in the app.
//
// Run: go run ./cmd/sync-nascar-live -data-dir=./data
// Recommended via cron every 1–2 minutes during race weekends.
// Or sync runs automatically while the server is up (background livesync).
package main

import (
	"flag"
	"log"

	"github.com/vX8q/tga/internal/livesync"
)

func main() {
	dataDir := flag.String("data-dir", "data", "каталог data (schedules, live.json)")
	flag.Parse()

	if err := livesync.SyncNASCAR(*dataDir); err != nil {
		log.Fatalf("sync-nascar-live: %v", err)
	}
}
