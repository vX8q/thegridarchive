// Package tableutil provides table parsing helpers.
package tableutil

import "strings"

func normalizeHeaderName(s string) string {
	return strings.TrimRight(strings.TrimSpace(strings.ToLower(s)), ".")
}

// ColIndex returns the column index by header name (case-insensitive).
// Trailing periods are ignored so "Pos." matches "Pos".
func ColIndex(headers []string, name string) int {
	lower := normalizeHeaderName(name)
	for i, h := range headers {
		if normalizeHeaderName(h) == lower {
			return i
		}
	}
	return -1
}

// FirstColIndex returns the index of the first column from a list of names (case-insensitive).
func FirstColIndex(headers []string, names ...string) int {
	for _, name := range names {
		if i := ColIndex(headers, name); i >= 0 {
			return i
		}
	}
	return -1
}

// RacePosColIndex finds finish-position columns, including FREC/F4 "Fin / ST".
func RacePosColIndex(headers []string) int {
	if i := FirstColIndex(headers, "Pos", "Fin", "Position", "POS"); i >= 0 {
		return i
	}
	for i, h := range headers {
		n := strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(n, "fin") && strings.Contains(n, "st") {
			return i
		}
	}
	return -1
}

// NormalizeRacePos maps "1 / ST 2 ▲1" → "1" and "NC / ST 28" → "NC".
func NormalizeRacePos(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	if strings.Contains(s, "/") {
		s = strings.TrimSpace(strings.SplitN(s, "/", 2)[0])
	}
	return s
}
