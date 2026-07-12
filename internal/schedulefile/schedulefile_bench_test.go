package schedulefile

import (
	"path/filepath"
	"testing"
)

// BenchmarkBuildDriverStatsFromEvents uses real JSON files from ./data
// to track performance regressions when logic changes.
func BenchmarkBuildDriverStatsFromEvents(b *testing.B) {
	dataDir := filepath.Join("..", "..", "data")
	series := []string{
		"NASCAR_CUP",
		"NASCAR_XFINITY",
		"INDYCAR",
		"SUPERCARS",
	}
	season := "2024"

	for _, s := range series {
		seriesID := s
		b.Run(seriesID, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				_, err := BuildDriverStatsFromEvents(dataDir, seriesID, season)
				if err != nil {
					b.Fatalf("BuildDriverStatsFromEvents(%s): %v", seriesID, err)
				}
			}
		})
	}
}

// BenchmarkBuildStandingsFromEvents tracks standings rebuild cost (see docs/PERFORMANCE.md).
func BenchmarkBuildStandingsFromEvents(b *testing.B) {
	dataDir := filepath.Join("..", "..", "data")
	cases := []struct {
		series string
		season string
	}{
		{"NASCAR_CUP", "2026"},
		{"F1", "2026"},
		{"ELMS", "2026"},
	}
	for _, tc := range cases {
		tc := tc
		b.Run(tc.series+"_"+tc.season, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				if tc.series == "ELMS" {
					_, err := BuildElmsStandingsFromEvents(dataDir, tc.season)
					if err != nil {
						b.Fatalf("BuildElmsStandingsFromEvents: %v", err)
					}
					continue
				}
				_, err := BuildStandingsFromEvents(dataDir, tc.series, tc.season)
				if err != nil {
					b.Fatalf("BuildStandingsFromEvents(%s): %v", tc.series, err)
				}
			}
		})
	}
}

