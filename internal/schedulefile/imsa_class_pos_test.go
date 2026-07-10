package schedulefile

import "testing"

func TestFillImsaClassPosInRows_BackfillsFromOverallPos(t *testing.T) {
	headers := []string{"POS", "CAR NO", "DRIVERS", "TEAM/CAR/SPONSOR", "CLASS", "CLASS POS"}
	rows := [][]string{
		{"1", "10", "A", "Team A", "GTD", "1"},
		{"2", "20", "B", "Team B", "GTD", ""},
		{"3", "30", "C", "Team C", "GTD Pro", "1"},
		{"4", "40", "D", "Team D", "GTD", ""},
	}
	if !FillImsaClassPosInRows(headers, rows) {
		t.Fatal("expected changes")
	}
	if rows[1][5] != "2" {
		t.Fatalf("row 1 CLASS POS = %q, want 2", rows[1][5])
	}
	if rows[3][5] != "3" {
		t.Fatalf("row 3 CLASS POS = %q, want 3", rows[3][5])
	}
}

func TestFillImsaClassPosInRows_SkipsWithoutClassColumn(t *testing.T) {
	headers := []string{"POS", "CAR NO", "CLASS POS", "DRIVERS"}
	rows := [][]string{{"1", "10", "", "Driver"}}
	if FillImsaClassPosInRows(headers, rows) {
		t.Fatal("expected no changes without CLASS column")
	}
}
