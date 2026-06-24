package models

import "time"

// FeedbackMessage is a user-submitted site feedback item.
type FeedbackMessage struct {
	ID        string
	Name      string
	Email     string
	Message   string
	PageURL   string
	Lang      string
	UserAgent string
	IPHash    string
	Status    string
	CreatedAt time.Time
}
