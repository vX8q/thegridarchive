// fill-imsa-class-pos backfills empty CLASS POS cells in IMSA event JSON files.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/vX8q/tga/internal/appenv"
	"github.com/vX8q/tga/internal/schedulefile"
)

func main() {
	dataDir := flag.String("data", "", "data directory (default: auto)")
	season := flag.String("season", "2026", "season year")
	dryRun := flag.Bool("dry-run", false, "report only, do not write files")
	flag.Parse()

	root := appenv.ResolveDataDir(*dataDir)
	dir := filepath.Join(root, "events", "IMSA", strings.TrimSpace(*season))
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Fatalf("read IMSA events: %v", err)
	}

	var updated int
	for _, ent := range entries {
		if ent.IsDir() || !strings.HasSuffix(ent.Name(), ".json") {
			continue
		}
		path := filepath.Join(dir, ent.Name())
		b, err := os.ReadFile(path) //nolint:gosec
		if err != nil {
			log.Printf("skip %s: %v", ent.Name(), err)
			continue
		}
		var detail schedulefile.EventDetailJSON
		if err := json.Unmarshal(b, &detail); err != nil {
			log.Printf("skip %s: parse %v", ent.Name(), err)
			continue
		}
		if !schedulefile.FillImsaClassPosInEventDetail(&detail) {
			continue
		}
		updated++
		if *dryRun {
			fmt.Println("would update", ent.Name())
			continue
		}
		out, err := json.MarshalIndent(&detail, "", "  ")
		if err != nil {
			log.Printf("marshal %s: %v", ent.Name(), err)
			continue
		}
		out = append(out, '\n')
		if err := os.WriteFile(path, out, 0o600); err != nil {
			log.Fatalf("write %s: %v", path, err)
		}
		fmt.Println("updated", ent.Name())
	}
	fmt.Printf("done: %d file(s)%s\n", updated, map[bool]string{true: " (dry-run)", false: ""}[*dryRun])
}
