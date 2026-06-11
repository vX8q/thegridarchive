package schedulefile

import (
	"math"
	"strconv"
	"strings"

	"github.com/vX8q/tga/internal/tableutil"
)

var driverDiacriticReplacer = strings.NewReplacer(
	"á", "a", "à", "a", "ä", "a", "â", "a", "ã", "a", "å", "a",
	"Á", "a", "À", "a", "Ä", "a", "Â", "a", "Ã", "a", "Å", "a",
	"é", "e", "è", "e", "ë", "e", "ê", "e",
	"É", "e", "È", "e", "Ë", "e", "Ê", "e",
	"í", "i", "ì", "i", "ï", "i", "î", "i",
	"Í", "i", "Ì", "i", "Ï", "i", "Î", "i",
	"ó", "o", "ò", "o", "ö", "o", "ô", "o", "õ", "o",
	"Ó", "o", "Ò", "o", "Ö", "o", "Ô", "o", "Õ", "o",
	"ú", "u", "ù", "u", "ü", "u", "û", "u",
	"Ú", "u", "Ù", "u", "Ü", "u", "Û", "u",
	"ñ", "n", "Ñ", "n",
)

// canonicalDriverKey returns a canonical key for a driver name in aggregating
// structures (standings/stats) to avoid duplicates from case, spacing, dots, and suffix differences only.
func canonicalDriverKey(name string) string {
	s := strings.TrimSpace(name)
	if s == "" {
		return ""
	}

	// Strip suffixes like "(i)", "(R)", "(G)".
	for _, suf := range []string{"(i)", "(I)", "(r)", "(R)", "(g)", "(G)"} {
		if strings.HasSuffix(s, suf) {
			s = strings.TrimSpace(s[:len(s)-len(suf)])
		}
	}

	// Strip "(NN races)" / "(NN race)" suffix.
	if idx := strings.LastIndex(s, "("); idx != -1 && strings.HasSuffix(s, ")") {
		inner := strings.TrimSpace(s[idx+1 : len(s)-1])
		parts := strings.Fields(inner)
		if len(parts) == 2 {
			numPart := parts[0]
			word := strings.ToLower(parts[1])
			allDigits := true
			for _, c := range numPart {
				if c < '0' || c > '9' {
					allDigits = false
					break
				}
			}
			if allDigits && strings.HasPrefix(word, "race") {
				s = strings.TrimSpace(s[:idx])
			}
		}
	}

	// Remove dots (Ricky Stenhouse Jr. → Ricky Stenhouse Jr).
	s = strings.ReplaceAll(s, ".", "")

	// Strip diacritics in common cases (Suárez → Suarez, etc.).
	s = driverDiacriticReplacer.Replace(s)

	// Normalize whitespace.
	s = strings.Join(strings.Fields(s), " ")
	return collapseSpacedInitials(strings.ToLower(s))
}

// collapseSpacedInitials collapses spaced initials at the start of a name: "a j allmendinger" -> "aj allmendinger".
func collapseSpacedInitials(sLower string) string {
	fields := strings.Fields(sLower)
	if len(fields) == 0 {
		return sLower
	}
	i := 0
	for i < len(fields) && len(fields[i]) == 1 {
		i++
	}
	if i <= 1 {
		return sLower
	}
	var initials strings.Builder
	for j := 0; j < i; j++ {
		initials.WriteString(fields[j])
	}
	rest := strings.Join(fields[i:], " ")
	if rest == "" {
		return initials.String()
	}
	return initials.String() + " " + rest
}

// preferredDriverName normalizes a few known variants so that merged rows
// keep a consistent display name (instead of picking an arbitrary variant).
// standingsAggregateKey is the standings row key: for F4 by car number (one driver
// may be "A. Aksoy" and "Alp Aksoy" across races), otherwise canonicalDriverKey.
func standingsAggregateKey(seriesID, driver, car string) string {
	car = strings.TrimSpace(car)
	if (strings.EqualFold(seriesID, "F4_IT") || strings.EqualFold(seriesID, "SMP_F4_RU")) && car != "" {
		return "#" + car
	}
	key := canonicalDriverKey(driver)
	if key == "" {
		return strings.TrimSpace(driver)
	}
	return key
}

// preferLongerDriverName keeps the fuller display name when merging rows.
// standingsRacePosCell is race position for a standings cell (no points).
func standingsRacePosCell(seriesID, raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "/") {
		s = strings.TrimSpace(strings.SplitN(s, "/", 2)[0])
	}
	if strings.EqualFold(seriesID, "F4_IT") || strings.EqualFold(seriesID, "SMP_F4_RU") {
		if i := strings.Index(s, "*"); i >= 0 {
			s = strings.TrimSpace(s[:i])
		}
	}
	return s
}

func preferLongerDriverName(existing, candidate string) string {
	existing = strings.TrimSpace(existing)
	candidate = strings.TrimSpace(candidate)
	if existing == "" {
		return candidate
	}
	if candidate == "" {
		return existing
	}
	if len(strings.Fields(candidate)) > len(strings.Fields(existing)) {
		return candidate
	}
	if len(candidate) > len(existing) {
		return candidate
	}
	return existing
}

func preferredDriverName(name string) string {
	raw := strings.TrimSpace(name)
	if raw == "" {
		return raw
	}
	// Compare using the same canonical-ish normalization, but keep display exact casing/punctuation.
	tmp := strings.ToLower(raw)
	tmp = strings.ReplaceAll(tmp, ".", "")
	tmp = driverDiacriticReplacer.Replace(tmp)
	tmp = collapseSpacedInitials(strings.Join(strings.Fields(tmp), " "))
	switch tmp {
	case "aj allmendinger":
		return "A. J. Allmendinger"
	case "bj mcleod":
		return "B. J. McLeod"
	case "jj yeley":
		return "J. J. Yeley"
	}
	return raw
}

func colIndex(headers []string, name string) int {
	return tableutil.ColIndex(headers, name)
}

func firstColIndex(headers []string, names ...string) int {
	return tableutil.FirstColIndex(headers, names...)
}

func valueAt(row []string, col int) string {
	if col < 0 || col >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[col])
}

// isAllDigits returns true if the string contains only digits 0–9 and is non-empty.
func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func atoiSafe(s string) int {
	s = strings.TrimSpace(s)
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}

func roundTo(x float64, prec int) float64 {
	if prec < 0 {
		return x
	}
	p := math.Pow10(prec)
	return math.Round(x*p) / p
}

func divSafe(num, den float64) float64 {
	if den == 0 {
		return 0
	}
	return num / den
}

func itoa(n int) string {
	return strconv.Itoa(n)
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n
}

