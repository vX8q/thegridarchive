package schedulefile

import (
	"strings"

	"github.com/vX8q/tga/config"
)

// buildStockCarCarByDriverFromEvents maps canonical driver key → car number from event entry lists.
func buildStockCarCarByDriverFromEvents(dataDir, seriesID, season string) map[string]string {
	if strings.TrimSpace(season) == "" {
		season = config.CurrentSeason
	}
	events, err := LoadEvents(dataDir, seriesID)
	if err != nil || len(events) == 0 {
		return nil
	}
	out := make(map[string]string)
	for _, ev := range events {
		if ev.Season != season {
			continue
		}
		detail, err := LoadEventDetail(dataDir, ev.ID)
		if err != nil || detail == nil || len(detail.EntryList) == 0 {
			continue
		}
		for _, ent := range detail.EntryList {
			driverKey := canonicalDriverKey(ent.Driver)
			num := strings.TrimSpace(ent.Number)
			if driverKey == "" || num == "" {
				continue
			}
			out[driverKey] = num
		}
	}
	return out
}

func enrichStockCarDriverStatsCars(dataDir, seriesID, season string, rows []DriverStatsRow) {
	carByDriver := buildStockCarCarByDriverFromEvents(dataDir, seriesID, season)
	if len(carByDriver) == 0 {
		return
	}
	for i := range rows {
		if strings.TrimSpace(rows[i].Car) != "" {
			continue
		}
		key := canonicalDriverKey(rows[i].Driver)
		if key == "" {
			continue
		}
		if car, ok := carByDriver[key]; ok && car != "" {
			rows[i].Car = car
		}
	}
}

func enrichStockCarStandingRowsCars(dataDir, seriesID, season string, rows []StandingRow) {
	carByDriver := buildStockCarCarByDriverFromEvents(dataDir, seriesID, season)
	if len(carByDriver) == 0 {
		return
	}
	for i := range rows {
		if strings.TrimSpace(rows[i].Car) != "" {
			continue
		}
		key := canonicalDriverKey(rows[i].Driver)
		if key == "" {
			continue
		}
		if car, ok := carByDriver[key]; ok && car != "" {
			rows[i].Car = car
		}
	}
}
