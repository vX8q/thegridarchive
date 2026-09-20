package schedulefile

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestResolveEventDetailID_SupercarsWeekend(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	cases := []struct {
		scheduleID string
		wantFile   string
	}{
		{"SUPERCARS_2026_1", "supercars_2026_1"},
		{"SUPERCARS_2026_3", "supercars_2026_1"},  // Sydney race 3 -> weekend 1
		{"SUPERCARS_2026_5", "supercars_2026_2"},  // Melbourne race 5 -> weekend 2
		{"SUPERCARS_2026_8", "supercars_2026_3"},  // Taupō
		{"SUPERCARS_2026_10", "supercars_2026_4"}, // Christchurch (Taupō R3 rescheduled)
		{"SUPERCARS_2026_13", "supercars_2026_4"}, // Christchurch
		{"SUPERCARS_2026_14", "supercars_2026_5"}, // Tasmania
		{"F1_2026_1", "f1_2026_1"},
		{"PSC_2026_6", "psc_2026_6"},
		{"PSC_2026_7", "psc_2026_6"}, // Zandvoort Race 2 → weekend file
		{"psc-2026-7", "psc_2026_6"},
	}
	for _, tc := range cases {
		got := ResolveEventDetailID(dataDir, tc.scheduleID)
		if got != tc.wantFile {
			t.Errorf("ResolveEventDetailID(%q) = %q, want %q", tc.scheduleID, got, tc.wantFile)
		}
	}
}

func TestPatchCanonicalEventIDFromRequest_SupercarsWeekendBundle(t *testing.T) {
	body := []byte(`{"event_id":"SUPERCARS_2026_2","race":"Melbourne SuperSprint"}`)
	got := PatchCanonicalEventIDFromRequest(body, "supercars-2026-4", "supercars_2026_2")
	var m map[string]string
	if err := json.Unmarshal(got, &m); err != nil {
		t.Fatal(err)
	}
	if m["canonical_event_id"] != "SUPERCARS_2026_2" {
		t.Fatalf("canonical_event_id = %q, want SUPERCARS_2026_2", m["canonical_event_id"])
	}
	if m["event_id"] != "SUPERCARS_2026_2" {
		t.Fatalf("event_id should stay bundle id, got %q", m["event_id"])
	}
	unchanged := PatchCanonicalEventIDFromRequest(body, "SUPERCARS_2026_2", "supercars_2026_2")
	if string(unchanged) != string(body) {
		t.Fatalf("expected no change when request matches file id")
	}
}

func TestPatchCanonicalEventIDFromRequest_PSCMergedWeekend(t *testing.T) {
	body := []byte(`{"event_id":"PSC_2026_6","race":"Zandvoort"}`)
	got := PatchCanonicalEventIDFromRequest(body, "psc-2026-7", "psc_2026_6")
	var m map[string]string
	if err := json.Unmarshal(got, &m); err != nil {
		t.Fatal(err)
	}
	if m["canonical_event_id"] != "PSC_2026_6" {
		t.Fatalf("canonical_event_id = %q, want PSC_2026_6", m["canonical_event_id"])
	}
}

func TestResolveSupercarsHTTPFileID(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}
	cases := []struct {
		request string
		want    string
	}{
		{"SUPERCARS_2026_2", "supercars_2026_2"},  // Melbourne weekend
		{"SUPERCARS_2026_4", "supercars_2026_4"},  // Christchurch weekend (not Melbourne race 1)
		{"SUPERCARS_2026_17", "supercars_2026_6"}, // Darwin via schedule race fallback
	}
	for _, tc := range cases {
		got := ResolveSupercarsHTTPFileID(dataDir, tc.request)
		if got != tc.want {
			t.Errorf("ResolveSupercarsHTTPFileID(%q) = %q, want %q", tc.request, got, tc.want)
		}
	}
}
