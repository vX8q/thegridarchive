package config

// PSC defines Porsche Supercup championship configuration.
// Race points: top 15 classified eligible drivers (25–1). Guest entries score 0;
// their finishing positions are skipped when awarding points.
var PSC = Championship{
	ID: "PSC", Name: "Porsche Supercup", Season: CurrentSeason,
	Type: SingleMake, Country: "World", Active: true,
}
