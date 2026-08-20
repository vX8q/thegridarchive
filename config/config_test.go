package config

import (
	"testing"
)

func TestSeasonFromSlug(t *testing.T) {
	tests := []struct {
		slug string
		want string
	}{
		{"f1-2024", "2024"},
		{"f1-2025", "2025"},
		{"indycar_2026", "2026"},
		{"noaps-2026", "2026"},
		{"nascar_cup", ""},
	}
	for _, tt := range tests {
		got := SeasonFromSlug(tt.slug)
		if got != tt.want {
			t.Errorf("SeasonFromSlug(%q) = %q, want %q", tt.slug, got, tt.want)
		}
	}
}

func TestDataSeriesID(t *testing.T) {
	tests := []struct {
		champID string
		want    string
	}{
		{"NASCAR_CUP", "nascar_cup"},
		{"nascar-cup", "nascar_cup"},
		{"NASCAR_XFinity", "noaps"},
		{"nascar_xfinity", "noaps"},
		{"F1", "f1"},
		{"f1-2024", "f1"},
		{"f1-2025", "f1"},
		{"f2_2026", "f2"},
		{"indycar-2026", "indycar"},
		{"noaps_2026", "noaps"},
		{"", ""},
	}
	for _, tt := range tests {
		got := DataSeriesID(tt.champID)
		if got != tt.want {
			t.Errorf("DataSeriesID(%q) = %q, want %q", tt.champID, got, tt.want)
		}
	}
}
