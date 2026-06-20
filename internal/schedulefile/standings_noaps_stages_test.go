package schedulefile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNOAPSStagePointsFromEventTables(t *testing.T) {
	dataDir := filepath.Join("..", "..", "data")
	if _, err := os.Stat(dataDir); err != nil {
		t.Skip("data dir missing")
	}

	data, err := BuildStandingsFromEvents(dataDir, "NOAPS", "2026")
	if err != nil || data == nil {
		t.Fatalf("build standings: %v", err)
	}
	before := stagesForDriver(data, "Justin Allgaier")

	EnrichStagesFromEvents(dataDir, "NOAPS", data)
	after := stagesForDriver(data, "Justin Allgaier")

	if before == "" || after == "" {
		t.Fatalf("missing Allgaier stages: before=%q after=%q", before, after)
	}
	if before != after {
		t.Fatalf("EnrichStagesFromEvents changed stages: before=%s after=%s", before, after)
	}
	// Regression: stale NASCAR.com TSV used to force 179 after Pocono while events sum to 242.
	if after == "179" {
		t.Fatalf("stage points still match stale TSV reference (179); want event-derived total %s", before)
	}
}

func stagesForDriver(data *StandingsData, name string) string {
	if data == nil {
		return ""
	}
	for _, row := range data.Rows {
		if row.Driver == name {
			return row.Stages
		}
	}
	return ""
}
