package schedulefile

import (
	"encoding/json"
	"fmt"
	"testing"
)

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

func TestApplyPSCRacePoints_halfPoints(t *testing.T) {
	entry := []EntryListRow{
		{Number: "9", Driver: "Guest", Guest: true},
	}
	table := &EventTable{
		Meta:    map[string]string{"half_points": "true", "Laps": "1"},
		Headers: []string{"Pos", "No.", "Driver", "Team", "Laps", "Best lap", "Points"},
		Rows: [][]string{
			{"1", "7", "P1", "T1", "1", "1:51.000", "0"},
			{"2", "1", "P2", "T2", "1", "1:51.500", "0"},
			{"3", "12", "P3", "T3", "1", "1:52.000", "0"},
			{"4", "2", "P4", "T4", "1", "1:53.000", "0"},
			{"5", "28", "P5", "T5", "1", "1:53.300", "0"},
			{"6", "11", "P6", "T6", "1", "1:53.800", "0"},
			{"7", "25", "P7", "T7", "1", "1:54.500", "0"},
			{"8", "15", "P8", "T8", "1", "1:54.500", "0"},
			{"9", "9", "Guest", "TG", "1", "1:55.000", "0"},
			{"10", "22", "P10", "T10", "1", "1:56.000", "0"},
		},
	}
	ApplyPSCRacePoints(entry, table)
	want := map[string]string{
		"7": "12.5", "1": "10", "12": "8.5", "2": "7", "28": "6",
		"11": "5", "25": "4.5", "15": "4", "9": "0", "22": "3.5",
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

func TestEnrichPSCEvent_preservesWeekendFields(t *testing.T) {
	body := []byte(`{
		"event_id": "PSC_2026_6",
		"start_date": "2026-08-22",
		"end_date": "2026-08-23",
		"entry_list": [{"number": "1", "driver": "A", "guest": true}],
		"tables": {
			"race": {
				"sessions": [{
					"title": "Race 1",
					"meta": {"Date": "Sat 22 Aug 2026", "Start": "18:00"},
					"headers": ["Pos", "No.", "Driver", "Points"],
					"rows": [["1", "1", "A", "99"]]
				}]
			}
		}
	}`)
	out, err := EnrichPSCEvent(body, "psc")
	if err != nil {
		t.Fatal(err)
	}
	var root map[string]interface{}
	if err := json.Unmarshal(out, &root); err != nil {
		t.Fatal(err)
	}
	if root["start_date"] != "2026-08-22" {
		t.Errorf("start_date = %v, want 2026-08-22", root["start_date"])
	}
	tables := root["tables"].(map[string]interface{})
	race := tables["race"].(map[string]interface{})
	sess := race["sessions"].([]interface{})[0].(map[string]interface{})
	meta := sess["meta"].(map[string]interface{})
	if meta["Start"] != "18:00" {
		t.Errorf("session meta Start = %v", meta["Start"])
	}
	row := sess["rows"].([]interface{})[0].([]interface{})
	if fmt.Sprint(row[3]) != "0" {
		t.Errorf("guest points = %v, want 0", row[3])
	}
}
