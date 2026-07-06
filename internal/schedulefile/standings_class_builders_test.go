package schedulefile

import (
	"path/filepath"
	"testing"
)

// Smoke test for per-class standings builders (not covered by BuildStandingsFromEvents).
func TestClassStandingsBuilders_2026(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}

	type builder struct {
		name string
		fn   func(string) (*StandingsData, error)
	}
	builders := []builder{
		{"IMSA", func(season string) (*StandingsData, error) {
			return BuildImsaStandingsFromEvents(dataDir, season)
		}},
		{"ELMS", func(season string) (*StandingsData, error) {
			return BuildElmsStandingsFromEvents(dataDir, season)
		}},
		{"WEC", func(season string) (*StandingsData, error) {
			return BuildWecStandingsFromEvents(dataDir, season)
		}},
		{"GTWCE_END", func(season string) (*StandingsData, error) {
			return BuildGtwceStandingsFromEvents(dataDir, "GTWCE_END", season)
		}},
		{"GTWCE_SPRINT", func(season string) (*StandingsData, error) {
			return BuildGtwceStandingsFromEvents(dataDir, "GTWCE_SPRINT", season)
		}},
	}

	for _, b := range builders {
		t.Run(b.name, func(t *testing.T) {
			data, err := b.fn("2026")
			if err != nil {
				t.Fatalf("%s: %v", b.name, err)
			}
			if data == nil {
				t.Fatalf("%s: nil standings", b.name)
			}
			if len(data.Classes) == 0 {
				t.Fatalf("%s: expected classes[]", b.name)
			}
			if len(data.Rows) != 0 {
				t.Fatalf("%s: flat rows should be empty (got %d)", b.name, len(data.Rows))
			}
			if len(data.RaceOrder) == 0 {
				t.Fatalf("%s: empty race_order", b.name)
			}
			if len(data.CompletedRaces) == 0 {
				t.Logf("%s: no completed_races yet (no filled events?)", b.name)
			}
		})
	}
}
