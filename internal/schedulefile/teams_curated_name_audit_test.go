package schedulefile

import (
	"path/filepath"
	"strings"
	"testing"
)

// TestTeamsCuratedNamesMatchEvents flags curated teams rows whose driver does not
// appear on the same car number in any season entry_list (after name normalization).
func TestTeamsCuratedNamesMatchEvents(t *testing.T) {
	dataDir, err := filepath.Abs("../../data")
	if err != nil {
		t.Fatal(err)
	}
	series := []struct {
		id     string
		season string
	}{
		{"f1", "2026"},
		{"f2", "2026"},
		{"f3", "2026"},
		{"frec", "2026"},
		{"indycar", "2026"},
		{"dtm", "2026"},
		{"super_formula", "2026"},
	}
	for _, s := range series {
		s := s
		t.Run(s.id, func(t *testing.T) {
			data, err := LoadTeamsForSeason(dataDir, s.id, s.season)
			if err != nil || data == nil || len(data.Teams) == 0 {
				t.Skip("no teams file")
			}
			events, err := LoadEvents(dataDir, s.id)
			if err != nil {
				t.Fatal(err)
			}
			eventKeys := map[string]map[string]bool{} // number -> folded driver key
			for _, ev := range events {
				if s.season != "" && ev.Season != "" && ev.Season != s.season {
					continue
				}
				detail, err := LoadEventDetail(dataDir, ev.ID)
				if err != nil || detail == nil {
					continue
				}
				for _, e := range detail.EntryList {
					num := strings.TrimSpace(e.Number)
					if num == "" {
						continue
					}
					for _, drv := range entryDrivers(e) {
						drv = strings.TrimSpace(drv)
						if drv == "" {
							continue
						}
						if eventKeys[num] == nil {
							eventKeys[num] = map[string]bool{}
						}
						eventKeys[num][driverMatchKey(drv)] = true
					}
				}
			}
			for _, row := range data.Teams {
				num := strings.TrimSpace(row.Number)
				drv := strings.TrimSpace(row.Driver)
				if num == "" || drv == "" || placeholderText(drv) {
					continue
				}
				keys := eventKeys[num]
				if len(keys) == 0 {
					continue
				}
				k := driverMatchKey(drv)
				if !keys[k] {
					t.Errorf("%s #%s curated %q not found in entry_list (key %q)", s.id, num, drv, k)
				}
			}
		})
	}
}
