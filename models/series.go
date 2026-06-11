package models

// Series is a championship in the DB (corresponds to config.Championship).
type Series struct {
	ID       string
	Name     string
	Season   string
	Type     string
	Country  string
}
