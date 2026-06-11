package models

// Team is a constructor (F1) or a team in bodywork series.
type Team struct {
	ID       string
	Name     string
	Country  string
	Car      string  // constructor/model (e.g. "Red Bull", "Penske")
}
