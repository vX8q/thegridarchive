package schedulefile

import (
	"fmt"
	"strings"
)

func smpQualPointsForPos(pos int) int {
	switch pos {
	case 1:
		return 6
	case 2:
		return 5
	case 3:
		return 4
	case 4:
		return 3
	case 5:
		return 2
	case 6:
		return 1
	default:
		return 0
	}
}

func smpEventShortLabel(ev EventJSON, moscowVisits *int) string {
	c := strings.ToLower(ev.CircuitName + " " + ev.Name + " " + ev.Location)
	switch {
	case strings.Contains(c, "moscow"):
		*moscowVisits++
		if *moscowVisits == 1 {
			return "MRA1"
		}
		return "MRA2"
	case strings.Contains(c, "kazan"):
		return "KZR"
	case strings.Contains(c, "igora"):
		return "IGO"
	case strings.Contains(c, "nizh") || strings.Contains(c, "нижегород"):
		return "NRG"
	case strings.Contains(c, "groz") || strings.Contains(c, "krepost") || strings.Contains(c, "грозн"):
		return "FGA"
	default:
		return "RND"
	}
}

func smpParseRaceCode(code string) (round, race int, ok bool) {
	_, err := fmt.Sscanf(strings.TrimSpace(code), "R%d-R%d", &round, &race)
	return round, race, err == nil && round > 0 && race >= 1 && race <= 4
}

// smpRoundPointsSum is the sum of points across all 6 round sessions (as on smpkarting.ru).
func smpRoundPointsSum(s [6]float64) (sum float64, kept [6]bool) {
	for i := 0; i < 6; i++ {
		kept[i] = true
		sum += s[i]
	}
	return sum, kept
}

