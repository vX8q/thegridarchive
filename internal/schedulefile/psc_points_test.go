package schedulefile

import "testing"

func TestApplyPSCRacePoints_guestsShiftPointsDown(t *testing.T) {
	entry := []EntryListRow{
		{Number: "4", Driver: "Guest A", Guest: true},
		{Number: "5", Driver: "Guest B", Guest: true},
		{Number: "6", Driver: "Guest C", Guest: true},
	}
	table := &EventTable{
		Headers: []string{"Pos", "No.", "Driver", "Team", "Laps", "Best lap", "Points"},
		Rows: [][]string{
			{"1", "1", "P1", "T1", "10", "", "0"},
			{"2", "2", "P2", "T2", "10", "", "0"},
			{"3", "3", "P3", "T3", "10", "", "0"},
			{"4", "4", "Guest A", "T4", "10", "", "99"},
			{"5", "5", "Guest B", "T5", "10", "", "99"},
			{"6", "6", "Guest C", "T6", "10", "", "99"},
			{"7", "7", "P7", "T7", "10", "", "0"},
			{"8", "8", "P8", "T8", "10", "", "0"},
		},
	}
	ApplyPSCRacePoints(entry, table)
	want := map[string]string{
		"1": "25", "2": "20", "3": "17",
		"4": "0", "5": "0", "6": "0",
		"7": "14", "8": "12",
	}
	for _, row := range table.Rows {
		car := row[1]
		got := row[6]
		if want[car] != got {
			t.Fatalf("car %s points = %q, want %q", car, got, want[car])
		}
	}
}

func TestApplyPSCRacePoints_monaco2026(t *testing.T) {
	d, err := LoadEventDetail("../../data", "PSC_2026_1")
	if err != nil || d == nil {
		t.Fatalf("load event: %v", err)
	}
	rr := d.Tables["race_results"]
	before := append([][]string{}, rr.Rows...)
	ApplyPSCRacePoints(d.EntryList, &rr)
	wantPts := map[string]string{
		"15": "25", "7": "20", "26": "17", "1": "14", "12": "12", "4": "10",
		"17": "9", "22": "8", "27": "7", "11": "6", "2": "5", "29": "4",
		"3": "3", "18": "2", "25": "1",
		"21": "0", "9": "0", "6": "0",
	}
	carCol := firstColIndex(rr.Headers, "No", "No.", "#", "Car")
	ptsCol := pointsColIndex(rr.Headers)
	for i, row := range rr.Rows {
		car := row[carCol]
		if want, ok := wantPts[car]; ok {
			if row[ptsCol] != want {
				t.Fatalf("car %s points = %q, want %q (row %d)", car, row[ptsCol], want, i)
			}
		}
	}
	_ = before
}
