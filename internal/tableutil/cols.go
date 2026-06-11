// Package tableutil provides table parsing helpers.
package tableutil

import "strings"

// ColIndex returns the column index by header name (case-insensitive).
func ColIndex(headers []string, name string) int {
	lower := strings.TrimSpace(strings.ToLower(name))
	for i, h := range headers {
		if strings.TrimSpace(strings.ToLower(h)) == lower {
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
