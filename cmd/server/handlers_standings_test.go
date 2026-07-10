package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vX8q/tga/internal/schedulefile"
)

func decodeStandingsResponse(t *testing.T, rec *httptest.ResponseRecorder) schedulefile.StandingsData {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var data schedulefile.StandingsData
	if err := json.NewDecoder(rec.Body).Decode(&data); err != nil {
		t.Fatalf("decode standings: %v", err)
	}
	return data
}

func TestHandleSeriesStandings_ELMS_ReturnsClassTables(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/elms/standings", nil)
	rec := httptest.NewRecorder()

	handleSeriesStandings(rec, req, dataDir, "ELMS", "2026")
	data := decodeStandingsResponse(t, rec)

	if len(data.Classes) == 0 {
		t.Fatal("ELMS API must return classes from auto-build")
	}
	if len(data.Rows) != 0 {
		t.Fatalf("ELMS standings should use class tables, not flat rows (got %d rows)", len(data.Rows))
	}

	var lmp2 *schedulefile.StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "LMP2" {
			lmp2 = &data.Classes[i]
			break
		}
	}
	if lmp2 == nil || len(lmp2.Rows) == 0 {
		t.Fatal("LMP2 class missing in ELMS API response")
	}
	if lmp2.Rows[0].Races["BAR"] == "" || lmp2.Rows[0].Races["LEC"] == "" {
		t.Errorf("LMP2 leader missing BAR/LEC: %#v", lmp2.Rows[0].Races)
	}
}

func TestHandleSeriesStandings_IMSA_ReturnsClassTables(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/imsa/standings", nil)
	rec := httptest.NewRecorder()

	handleSeriesStandings(rec, req, dataDir, "IMSA", "2026")
	data := decodeStandingsResponse(t, rec)

	if len(data.Classes) == 0 {
		t.Fatal("IMSA API must return classes from auto-build")
	}
	var gtp *schedulefile.StandingsClass
	for i := range data.Classes {
		if data.Classes[i].ID == "GTP" {
			gtp = &data.Classes[i]
			break
		}
	}
	if gtp == nil {
		t.Fatal("GTP class missing in IMSA API response")
	}
	var car31 *schedulefile.StandingRow
	for i := range gtp.Rows {
		if gtp.Rows[i].Car == "31" {
			car31 = &gtp.Rows[i]
			break
		}
	}
	if car31 == nil {
		t.Fatal("GTP #31 missing in IMSA API response")
	}
	if car31.Races["DET"] != "1" {
		t.Errorf("GTP #31 DET race = %q, want 1", car31.Races["DET"])
	}
	if car31.Quals["DET"] != "1" {
		t.Errorf("GTP #31 DET qual = %q, want 1 (official GTP pole, 35 qual pts)", car31.Quals["DET"])
	}
}

func TestHandleSeriesStandings_ARCA_IncludesElkRound(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/arca/standings", nil)
	rec := httptest.NewRecorder()

	handleSeriesStandings(rec, req, dataDir, "ARCA", "2026")
	data := decodeStandingsResponse(t, rec)

	foundElk := false
	for _, code := range data.CompletedRaces {
		if code == "ELK" {
			foundElk = true
			break
		}
	}
	if !foundElk {
		t.Fatalf("ARCA completed_races should include ELK after round 10: %v", data.CompletedRaces)
	}
	var reaves *schedulefile.StandingRow
	for i := range data.Rows {
		if strings.Contains(data.Rows[i].Driver, "Max Reaves") {
			reaves = &data.Rows[i]
			break
		}
	}
	if reaves == nil || reaves.Races["ELK"] != "1" {
		t.Fatalf("Max Reaves ELK result = %#v", reaves)
	}
}

func TestHandleSeriesStandings_F1_CanadaMonacoColumns(t *testing.T) {
	dataDir := testDataDir(t)
	req := httptest.NewRequest(http.MethodGet, "/api/series/f1/standings", nil)
	rec := httptest.NewRecorder()

	handleSeriesStandings(rec, req, dataDir, "F1", "2026")
	data := decodeStandingsResponse(t, rec)

	var ant *schedulefile.StandingRow
	for i := range data.Rows {
		if data.Rows[i].Driver == "Kimi Antonelli" {
			ant = &data.Rows[i]
			break
		}
	}
	if ant == nil {
		t.Fatal("Kimi Antonelli not in F1 standings API response")
	}
	if ant.Races["R5F"] != "1" {
		t.Errorf("Canada feature R5F = %q, want 1", ant.Races["R5F"])
	}
	if ant.Races["R6"] != "1" {
		t.Errorf("Monaco R6 = %q, want 1", ant.Races["R6"])
	}
}
