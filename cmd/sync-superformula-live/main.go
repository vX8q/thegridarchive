// sync-superformula-live connects to the RaceNow websocket (superformula.racelive.jp)
// and updates data/live.json for Super Formula. Does not overwrite other live.json entries.
//
// Run: go run ./cmd/sync-superformula-live -data-dir=./data
package main

import (
	"flag"
	"log"

	"github.com/vX8q/tga/internal/livesync"
)

func main() {
	dataDir := flag.String("data-dir", "data", "каталог data (schedules, live.json)")
	flag.Parse()

	if err := livesync.SyncSuperFormula(*dataDir); err != nil {
		log.Fatalf("sync-superformula-live: %v", err)
	}
}
