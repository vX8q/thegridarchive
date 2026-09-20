package schedulefile

import (
	"sort"
	"strings"
)

const (
	chaseStatusIn     = "in"
	chaseRoundRegular = "regular_season"
	chaseRoundChase   = "the_chase"
)

// Official 2026 Chase seeds (NASCAR.com, 12 Jan / 31 Aug 2026).
// 1st = 2100, 2nd = 2075, 3rd = 2065, then −5 per place through 16th = 2000.
// NOAPS uses the first 12; Truck uses the first 10.
var chaseSeedPoints = []int{
	2100, 2075, 2065, 2060, 2055, 2050, 2045, 2040,
	2035, 2030, 2025, 2020, 2015, 2010, 2005, 2000,
}

// chaseConfig is The Chase layout for one national NASCAR tour (2026).
// No elimination rounds: the whole field stays in until Homestead.
type chaseConfig struct {
	RegularSeasonRaces int
	FieldSize          int
}

type chaseDriver struct {
	Key        string
	Name       string
	Eligible   bool
	RacePts    map[string]float64
	Pos        map[string]string
	StageWins  map[string]int
	Points     float64
	PlayoffPts int
	Status     string
	rsPoints   float64
	rsWins     int
}

func stockCarChaseConfig(seriesID string) (chaseConfig, bool) {
	switch strings.ToUpper(strings.TrimSpace(seriesID)) {
	case "NASCAR_CUP":
		return chaseConfig{RegularSeasonRaces: 26, FieldSize: 16}, true
	case "NOAPS":
		return chaseConfig{RegularSeasonRaces: 24, FieldSize: 12}, true
	case "NASCAR_TRUCK":
		return chaseConfig{RegularSeasonRaces: 18, FieldSize: 10}, true
	default:
		return chaseConfig{}, false
	}
}

func chaseSeedForRank(rank int) int {
	if rank < 0 || rank >= len(chaseSeedPoints) {
		return 2000
	}
	return chaseSeedPoints[rank]
}

func stockCarRaceWin(pos string) bool {
	s := strings.TrimSpace(pos)
	if i := strings.IndexAny(s, ".*"); i >= 0 {
		s = strings.TrimSpace(s[:i])
	}
	return s == "1"
}

func chaseCodeSet(codes []string) map[string]bool {
	out := make(map[string]bool, len(codes))
	for _, c := range codes {
		if c != "" {
			out[c] = true
		}
	}
	return out
}

func allCodesCompleted(codes []string, done map[string]bool) bool {
	if len(codes) == 0 {
		return false
	}
	for _, c := range codes {
		if !done[c] {
			return false
		}
	}
	return true
}

func completedSubset(codes []string, done map[string]bool) []string {
	var out []string
	for _, c := range codes {
		if done[c] {
			out = append(out, c)
		}
	}
	return out
}

func chaseSumPts(d *chaseDriver, codes []string) float64 {
	if d == nil || d.RacePts == nil {
		return 0
	}
	var s float64
	for _, c := range codes {
		s += d.RacePts[c]
	}
	return s
}

func chaseCountWins(d *chaseDriver, codes []string) int {
	if d == nil || d.Pos == nil {
		return 0
	}
	n := 0
	for _, c := range codes {
		if stockCarRaceWin(d.Pos[c]) {
			n++
		}
	}
	return n
}

func fillRegularSeasonStats(eligible []*chaseDriver, rsCodes []string) {
	for _, d := range eligible {
		d.rsPoints = chaseSumPts(d, rsCodes)
		d.rsWins = chaseCountWins(d, rsCodes)
		d.PlayoffPts = 0
	}
}

func sortEligibleByRegularSeason(list []*chaseDriver) {
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].rsPoints != list[j].rsPoints {
			return list[i].rsPoints > list[j].rsPoints
		}
		if list[i].rsWins != list[j].rsWins {
			return list[i].rsWins > list[j].rsWins
		}
		return list[i].Name < list[j].Name
	})
}

func selectChaseField(eligible []*chaseDriver, n int) []*chaseDriver {
	if n <= 0 {
		return nil
	}
	ranked := append([]*chaseDriver(nil), eligible...)
	sortEligibleByRegularSeason(ranked)
	if len(ranked) > n {
		ranked = ranked[:n]
	}
	return ranked
}

func applyStockCarChase(cfg chaseConfig, raceOrder, completed []string, drivers []*chaseDriver) *ChaseState {
	state := &ChaseState{
		Round:              chaseRoundRegular,
		FieldSize:          cfg.FieldSize,
		Cutline:            cfg.FieldSize,
		RegularSeasonRaces: cfg.RegularSeasonRaces,
	}
	if cfg.FieldSize <= 0 {
		return state
	}

	var eligible []*chaseDriver
	for _, d := range drivers {
		if d != nil && d.Eligible {
			eligible = append(eligible, d)
		}
	}

	if len(raceOrder) < cfg.RegularSeasonRaces {
		fillRegularSeasonStats(eligible, raceOrder)
		return state
	}

	rsCodes := append([]string(nil), raceOrder[:cfg.RegularSeasonRaces]...)
	chaseCodes := append([]string(nil), raceOrder[cfg.RegularSeasonRaces:]...)
	done := chaseCodeSet(completed)
	fillRegularSeasonStats(eligible, rsCodes)
	if !allCodesCompleted(rsCodes, done) {
		return state
	}

	state.Active = true
	state.Round = chaseRoundChase
	field := selectChaseField(eligible, cfg.FieldSize)
	fieldSet := make(map[string]bool, len(field))
	for i, d := range field {
		d.Points = float64(chaseSeedForRank(i))
		d.Status = chaseStatusIn
		fieldSet[d.Key] = true
	}
	for _, d := range eligible {
		if !fieldSet[d.Key] {
			d.Points = d.rsPoints
			d.Status = ""
		}
	}

	chaseDone := completedSubset(chaseCodes, done)
	if len(chaseDone) > 0 {
		for _, d := range eligible {
			d.Points += chaseSumPts(d, chaseDone)
		}
	}
	return state
}
