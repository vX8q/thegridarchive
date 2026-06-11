package schedulefile

import (
	"testing"

	"github.com/vX8q/tga/models"
)

func TestPickDriverPrimaryContextFromResults_moreStartsWins(t *testing.T) {
	rows := []models.DriverSeasonResult{
		{SeriesID: "NOAPS", SeriesName: "NASCAR O'Reilly Auto Parts Series", TeamName: "JR Motorsports"},
		{SeriesID: "NOAPS", SeriesName: "NASCAR O'Reilly Auto Parts Series", TeamName: "JR Motorsports"},
		{SeriesID: "NOAPS", SeriesName: "NASCAR O'Reilly Auto Parts Series", TeamName: "JR Motorsports"},
		{SeriesID: "NASCAR_CUP", SeriesName: "NASCAR Cup Series", TeamName: "Hendrick Motorsports"},
		{SeriesID: "NASCAR_CUP", SeriesName: "NASCAR Cup Series", TeamName: "Hendrick Motorsports"},
	}
	got := PickDriverPrimaryContextFromResults(rows)
	if got.SeriesID != "NOAPS" {
		t.Fatalf("SeriesID = %q, want NOAPS", got.SeriesID)
	}
	if got.TeamName != "JR Motorsports" {
		t.Fatalf("TeamName = %q, want JR Motorsports", got.TeamName)
	}
	if got.Starts != 3 {
		t.Fatalf("Starts = %d, want 3", got.Starts)
	}
}

func TestPickDriverPrimaryContextFromResults_tieUsesSeriesPriority(t *testing.T) {
	rows := []models.DriverSeasonResult{
		{SeriesID: "NOAPS", SeriesName: "NASCAR O'Reilly Auto Parts Series", TeamName: "JR Motorsports"},
		{SeriesID: "NASCAR_CUP", SeriesName: "NASCAR Cup Series", TeamName: "Hendrick Motorsports"},
	}
	got := PickDriverPrimaryContextFromResults(rows)
	if got.SeriesID != "NASCAR_CUP" {
		t.Fatalf("SeriesID = %q, want NASCAR_CUP on tie", got.SeriesID)
	}
}

func TestSearchDriverSlug_stripsIneligibleMarker(t *testing.T) {
	if got := searchDriverSlug("Kyle Larson (i)"); got != "kyle-larson" {
		t.Fatalf("searchDriverSlug = %q, want kyle-larson", got)
	}
}

func TestSearchDriverSlug_stripsGuestMarker(t *testing.T) {
	if got := searchDriverSlug("Rodin Younessi (G)"); got != "rodin-younessi" {
		t.Fatalf("searchDriverSlug = %q, want rodin-younessi", got)
	}
}

func TestDriverMatchKey_stripsGuestMarker(t *testing.T) {
	a := DriverMatchKey("Taichi Watarai")
	b := DriverMatchKey("Taichi Watarai (G)")
	if a != b {
		t.Fatalf("DriverMatchKey guest mismatch: %q vs %q", a, b)
	}
}
