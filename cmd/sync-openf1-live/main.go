// sync-openf1-live polls the OpenF1 API (api.openf1.org), detects the current
// live session (practice, qualifying, race), and updates data/live.json for F1.
// Does not overwrite other live.json entries (NASCAR, etc.) — only adds/removes F1.
//
// Run: go run ./cmd/sync-openf1-live -data-dir=./data
// Recommended via cron every 1–2 minutes on F1 race weekends.
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

	if err := livesync.SyncOpenF1(*dataDir); err != nil {
		log.Fatalf("sync-openf1-live: %v", err)
	}
}
