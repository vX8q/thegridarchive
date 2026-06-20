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
