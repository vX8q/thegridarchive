package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleSeries_F1_2024_EventsAndTeams(t *testing.T) {
	dataDir := testDataDir(t)

	t.Run("events", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/series/f1-2024/events", nil)
		rec := httptest.NewRecorder()
		handleSeriesEvents(rec, req, dataDir, "f1", nil, "2024")
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		var events []map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&events); err != nil {
			t.Fatal(err)
		}
		if len(events) != 24 {
			t.Fatalf("events = %d, want 24", len(events))
		}
		for _, ev := range events {
			if season, _ := ev["season"].(string); season != "" && season != "2024" {
				t.Fatalf("leaked season %q in f1-2024 events", season)
			}
			id, _ := ev["id"].(string)
			if id != "" && !strings.Contains(strings.ToUpper(id), "2024") {
				t.Fatalf("unexpected event id %q", id)
			}
		}
	})

	t.Run("teams", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/series/f1-2024/teams", nil)
		rec := httptest.NewRecorder()
		handleSeriesTeams(rec, req, dataDir, "f1", "2024")
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
		}
		var payload struct {
			Teams []struct {
				Team         string `json:"team"`
				Manufacturer string `json:"manufacturer"`
				Chassis      string `json:"chassis"`
				PowerUnit    string `json:"power_unit"`
				Driver       string `json:"driver"`
				Rounds       string `json:"rounds"`
			} `json:"teams"`
		}
		if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Teams) != 25 {
			t.Fatalf("teams = %d, want 25", len(payload.Teams))
		}
		if payload.Teams[0].Team != "BWT Alpine F1 Team" {
			t.Fatalf("first team = %q want Alpine", payload.Teams[0].Team)
		}
		type meta struct {
			Manufacturer, Chassis, PowerUnit, Rounds string
		}
		byDriver := map[string]meta{}
		for _, tm := range payload.Teams {
			if tm.Chassis == "RB22" || tm.Chassis == "MCL40" || tm.Chassis == "SF-26" {
				t.Fatalf("2026 chassis leaked: %+v", tm)
			}
			byDriver[tm.Driver+"|"+tm.Team] = meta{tm.Manufacturer, tm.Chassis, tm.PowerUnit, tm.Rounds}
		}
		ver := byDriver["Max Verstappen|Oracle Red Bull Racing"]
		if ver.Manufacturer != "Red Bull Racing-Honda RBPT" || ver.Chassis != "RB20" || ver.PowerUnit != "Honda RBPTH002" || ver.Rounds != "1–24" {
			t.Fatalf("Verstappen meta %+v", ver)
		}
		doohan := byDriver["Jack Doohan|BWT Alpine F1 Team"]
		if doohan.Rounds != "24" || doohan.Chassis != "A524" || doohan.Manufacturer != "Alpine-Renault" {
			t.Fatalf("Doohan meta %+v", doohan)
		}
		haasBearman := byDriver["Oliver Bearman|MoneyGram Haas F1 Team"]
		if haasBearman.Rounds != "17, 21" || haasBearman.PowerUnit != "Ferrari 066/10" {
			t.Fatalf("Haas Bearman meta %+v", haasBearman)
		}
	})
}
