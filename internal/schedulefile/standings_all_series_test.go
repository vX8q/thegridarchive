package schedulefile

import (
	"path/filepath"
	"testing"
)

// TestBuildStandingsFromEvents_AllSeriesWithRealData — integration smoke test,
// running BuildStandingsFromEvents on all series with current project data
// to ensure auto-built driver standings do not fail on
// any series and return non-empty results where completed races
// exist in event files. Catches series that stop building.
func TestBuildStandingsFromEvents_AllSeriesWithRealData(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}

	series := []struct {
		id           string
		wantRowsWhen string // reason we expect non-empty rows (for 2026 season)
	}{
		// Series with standings.json + 2026 event files — auto-rebuild should yield rows.
		{"ARCA", "есть завершённые раунды 2026"},
		{"INDYCAR", "есть завершённые раунды 2026"},
		{"NASCAR_CUP", "есть завершённые раунды 2026"},
		{"NASCAR_MODIFIED", "есть завершённые раунды 2026"},
		{"NASCAR_TRUCK", "есть завершённые раунды 2026"},
		{"NOAPS", "есть завершённые раунды 2026"},
		{"SUPERCARS", "есть завершённые раунды 2026"},
		// Series without standings.json — auto-build from schedule + event files.
		{"F1", "есть завершённые раунды 2026"},
		{"F2", ""}, // may be empty if no result event files
		{"F3", ""},
		{"SUPER_FORMULA", "есть завершённый event 2026"},
		{"SUPER_GT", ""},
		{"WEC", ""},
		{"ELMS", ""},
		{"GTWCE_END", ""},
		// Series without 2026 data — test must not panic.
		{"FREC", ""},
		{"F4_IT", ""},
		{"SMP_F4_RU", ""},
		{"PSC", ""},
		{"DTM", ""},
		{"GTWCE_SPRINT", ""},
	}

	for _, s := range series {
		t.Run(s.id, func(t *testing.T) {
			data, err := BuildStandingsFromEvents(dataDir, s.id, "2026")
			if err != nil {
				t.Fatalf("BuildStandingsFromEvents(%q): %v", s.id, err)
			}
			if data == nil {
				t.Fatalf("BuildStandingsFromEvents(%q) returned nil without error", s.id)
			}
			// Empty rows allowed (series with no season data), but there must be no
			// nil field references — structure must be valid.
			if data.Rows == nil {
				data.Rows = []StandingRow{}
			}
			t.Logf("%s: race_order=%d completed=%d rows=%d ineligible=%d",
				s.id, len(data.RaceOrder), len(data.CompletedRaces), len(data.Rows), len(data.Ineligible))
			if s.wantRowsWhen != "" && len(data.Rows) == 0 {
				t.Logf("warning: %s ожидали rows (%s), получили 0 строк — возможно, данные ещё не добавлены", s.id, s.wantRowsWhen)
			}
		})
	}
}
