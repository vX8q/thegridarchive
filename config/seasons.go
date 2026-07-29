package config

// Season is a championship season (kept for documentation / future import tooling).
type Season struct {
	ChampionshipID string
	SeasonYear     string // "2026"
	Active         bool
}
