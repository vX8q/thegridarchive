package schedulefile

import "strings"

// canonicalizeF1Constructor maps short / legacy Constructor labels onto the
// FIA constructors' championship names used in later 2025 protocols.
func canonicalizeF1Constructor(name string) string {
	s := strings.TrimSpace(name)
	switch s {
	case "McLaren":
		return "McLaren-Mercedes"
	case "Red Bull Racing":
		return "Red Bull Racing-Honda RBPT"
	case "Racing Bulls", "RB", "Visa Cash App RB":
		return "Racing Bulls-Honda RBPT"
	case "Williams":
		return "Williams-Mercedes"
	case "Aston Martin":
		return "Aston Martin Aramco-Mercedes"
	case "Alpine":
		return "Alpine-Renault"
	case "Haas F1 Team", "Haas":
		return "Haas-Ferrari"
	case "Kick Sauber", "Sauber", "Stake F1 Team Kick Sauber":
		return "Kick Sauber-Ferrari"
	default:
		return s
	}
}

// splitDriversCell splits a multi-driver cell value
// (endurance/Super GT format: "Driver A; Driver B" or "A / B / C") into
// a list of names. Empty elements and whitespace are dropped.
//
// Supported separators:
//   - ";"  (Super GT)
//   - "/"  (WEC/ELMS/IMSA)
//   - ","  (rare fallback)
//
// With no separators, returns a single element with the original string
// (after TrimSpace). Empty string → empty result.
func splitDriversCell(raw string) []string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil
	}
	seps := []string{";", "/", ","}
	parts := []string{s}
	for _, sep := range seps {
		var next []string
		for _, p := range parts {
			for _, x := range strings.Split(p, sep) {
				x = strings.TrimSpace(x)
				if x != "" {
					next = append(next, x)
				}
			}
		}
		if len(next) > 0 {
			parts = next
		}
	}
	// Final pass to drop empty values.
	out := parts[:0]
	seen := make(map[string]struct{}, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, dup := seen[p]; dup {
			// A driver may appear twice in one race (rare source typo)
			// — count once to avoid duplicating points.
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

// driversFromRow returns drivers from a results row, supporting
// single "Driver" column (sprint series) and "Drivers"
// (endurance: WEC/ELMS/IMSA/Super GT/GTWC Endurance). If neither column
// exists — returns nil. For "Driver" returns a single element.
func driversFromRow(headers []string, row []string) []string {
	driverCol := colIndex(headers, "Driver")
	if driverCol >= 0 && driverCol < len(row) {
		name := strings.TrimSpace(row[driverCol])
		if name == "" {
			return nil
		}
		return []string{name}
	}
	driversCol := colIndex(headers, "Drivers")
	if driversCol >= 0 && driversCol < len(row) {
		return splitDriversCell(row[driversCol])
	}
	return nil
}

// pointsColIndex returns the points column index for varying header names
// across series: "Points", "Pts", "Pts.", and "DP" (Super GT,
// driver points — unlike "TP" for team). Returns -1 if not found.
func pointsColIndex(headers []string) int {
	candidates := []string{"Points", "Pts", "Pts.", "DP"}
	for _, c := range candidates {
		if i := colIndex(headers, c); i >= 0 {
			return i
		}
	}
	return -1
}
