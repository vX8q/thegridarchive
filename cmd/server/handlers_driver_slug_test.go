package main

import "testing"

func TestProfileDisplayName_LegalFullName(t *testing.T) {
	got := profileDisplayName("charles-leclerc", driverProfile{
		FullName: "Charles Marc Hervé Perceval Leclerc",
	})
	if got != "Charles Leclerc" {
		t.Fatalf("display = %q, want Charles Leclerc", got)
	}
	got = profileDisplayName("fernando-alonso", driverProfile{
		FullName: "Fernando Alonso Díaz",
	})
	if got != "Fernando Alonso" {
		t.Fatalf("display = %q, want Fernando Alonso", got)
	}
}

func TestProfileLegalName(t *testing.T) {
	legal := profileLegalName("charles-leclerc", driverProfile{FullName: "Charles Marc Hervé Perceval Leclerc"})
	if legal == "" {
		t.Fatal("expected legal name")
	}
	short := profileLegalName("lando-norris", driverProfile{FullName: "Lando Norris"})
	if short != "" {
		t.Fatalf("two-part name should not be legal-only, got %q", short)
	}
	got := profileLegalName("nico-hulkenberg", driverProfile{FullName: "Nicolas Hülkenberg"})
	if got != "Nicolas Hülkenberg" {
		t.Fatalf("legal = %q, want Nicolas Hülkenberg", got)
	}
	display := profileDisplayName("nico-hulkenberg", driverProfile{FullName: "Nicolas Hülkenberg"})
	if display != "Nico Hülkenberg" {
		t.Fatalf("display = %q, want Nico Hülkenberg", display)
	}
}

func TestResolveDriverProfileSlug_Redirect(t *testing.T) {
	profiles := map[string]driverProfile{
		"charles-leclerc": {FullName: "Charles Marc Hervé Perceval Leclerc"},
	}
	redirects := map[string]string{
		"charles-marc-herve-perceval-leclerc": "charles-leclerc",
	}
	got := resolveDriverProfileSlug("charles-marc-herve-perceval-leclerc", profiles, redirects)
	if got != "charles-leclerc" {
		t.Fatalf("got %q, want charles-leclerc", got)
	}
}
