package schedulefile

import (
	"path/filepath"
	"testing"
)

// Expected schedule race ID → weekend bundle file (supercars_2026_N.json).
var supercars2026WeekendFiles = map[string]string{
	"SUPERCARS_2026_1":  "supercars_2026_1",
	"SUPERCARS_2026_2":  "supercars_2026_1",
	"SUPERCARS_2026_3":  "supercars_2026_1",
	"SUPERCARS_2026_4":  "supercars_2026_2",
	"SUPERCARS_2026_5":  "supercars_2026_2",
	"SUPERCARS_2026_6":  "supercars_2026_2",
	"SUPERCARS_2026_7":  "supercars_2026_2",
	"SUPERCARS_2026_8":  "supercars_2026_3",
	"SUPERCARS_2026_9":  "supercars_2026_3",
	"SUPERCARS_2026_10": "supercars_2026_4",
	"SUPERCARS_2026_11": "supercars_2026_4",
	"SUPERCARS_2026_12": "supercars_2026_4",
	"SUPERCARS_2026_13": "supercars_2026_4",
	"SUPERCARS_2026_14": "supercars_2026_5",
	"SUPERCARS_2026_15": "supercars_2026_5",
	"SUPERCARS_2026_16": "supercars_2026_5",
	"SUPERCARS_2026_17": "supercars_2026_6",
	"SUPERCARS_2026_18": "supercars_2026_6",
	"SUPERCARS_2026_19": "supercars_2026_6",
	"SUPERCARS_2026_20": "supercars_2026_7",
	"SUPERCARS_2026_21": "supercars_2026_7",
	"SUPERCARS_2026_22": "supercars_2026_7",
	"SUPERCARS_2026_23": "supercars_2026_8",
	"SUPERCARS_2026_24": "supercars_2026_8",
	"SUPERCARS_2026_25": "supercars_2026_8",
	"SUPERCARS_2026_26": "supercars_2026_9",
	"SUPERCARS_2026_27": "supercars_2026_9",
	"SUPERCARS_2026_28": "supercars_2026_9",
	"SUPERCARS_2026_29": "supercars_2026_10",
	"SUPERCARS_2026_30": "supercars_2026_11",
	"SUPERCARS_2026_31": "supercars_2026_12",
	"SUPERCARS_2026_32": "supercars_2026_12",
	"SUPERCARS_2026_33": "supercars_2026_13",
	"SUPERCARS_2026_34": "supercars_2026_13",
	"SUPERCARS_2026_35": "supercars_2026_14",
	"SUPERCARS_2026_36": "supercars_2026_14",
	"SUPERCARS_2026_37": "supercars_2026_14",
}

func TestResolveEventDetailID_Supercars2026AllRaces(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	for scheduleID, wantFile := range supercars2026WeekendFiles {
		got := ResolveEventDetailID(dataDir, scheduleID)
		if got != wantFile {
			t.Errorf("ResolveEventDetailID(%q) = %q, want %q", scheduleID, got, wantFile)
		}
	}
}

func TestSupercarsWeekendFileID(t *testing.T) {
	if got := SupercarsWeekendFileID("2026", 6); got != "supercars_2026_6" {
		t.Fatalf("SupercarsWeekendFileID = %q", got)
	}
}
