package driverutil

import "testing"

func TestFormatDisplayTeamName(t *testing.T) {
	tests := []struct {
		in, want string
	}{
		{"UNITED AUTOSPORTS", "United Autosports"},
		{"AF CORSE", "AF Corse"},
		{"AO BY TF", "AO by TF"},
		{"CLX MOTORSPORT", "CLX Motorsport"},
		{"FORESTIER RACING BY PANIS", "Forestier Racing by Panis"},
		{"INTER EUROPOL COMPETITION", "Inter Europol Competition"},
		{"Joe Gibbs Racing", "Joe Gibbs Racing"},
		{"Red Bull Racing", "Red Bull Racing"},
		{"", ""},
		{"  ", ""},
		{"JR MOTORSPORTS", "JR Motorsports"},
		{"DUQUEINE TEAM", "Duqueine Team"},
	}
	for _, tt := range tests {
		got := FormatDisplayTeamName(tt.in)
		if got != tt.want {
			t.Errorf("FormatDisplayTeamName(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}
