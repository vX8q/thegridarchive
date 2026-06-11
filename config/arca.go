// Package config defines championship settings.
package config

// ARCA is a NASCAR-sanctioned organization.
var ARCA = Championship{
	ID: "ARCA", Name: "ARCA Menards Series", Season: CurrentSeason,
	Type: StockCarRacing, Country: "USA", Active: true,
}
