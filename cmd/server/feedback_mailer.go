package main

import (
	"context"
	"errors"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/vX8q/tga/models"
)

var errFeedbackEmailNotConfigured = errors.New("feedback email not configured")

type feedbackNotifier interface {
	NotifyFeedback(ctx context.Context, msg *models.FeedbackMessage) error
}

type noopFeedbackNotifier struct{}

func (noopFeedbackNotifier) NotifyFeedback(_ context.Context, _ *models.FeedbackMessage) error {
	return errFeedbackEmailNotConfigured
}

type smtpFeedbackNotifier struct {
	cfg FeedbackSMTPConfig
}

func newFeedbackNotifier(cfg FeedbackSMTPConfig) feedbackNotifier {
	if strings.TrimSpace(cfg.Host) == "" || strings.TrimSpace(cfg.To) == "" {
		return noopFeedbackNotifier{}
	}
	return smtpFeedbackNotifier{cfg: cfg}
}

func (n smtpFeedbackNotifier) NotifyFeedback(_ context.Context, msg *models.FeedbackMessage) error {
	host := strings.TrimSpace(n.cfg.Host)
	port := strings.TrimSpace(n.cfg.Port)
	if port == "" {
		port = "587"
	}
	username := strings.TrimSpace(n.cfg.Username)
	password := strings.ReplaceAll(strings.TrimSpace(n.cfg.Password), " ", "")
	from := strings.TrimSpace(n.cfg.From)
	if from == "" {
		from = username
	}
	to := strings.TrimSpace(n.cfg.To)
	if host == "" || from == "" || to == "" || username == "" || password == "" {
		return errFeedbackEmailNotConfigured
	}

	subject := "TGA feedback"
	body := fmt.Sprintf(
		"New TGA feedback\n\nName: %s\nEmail: %s\nPage: %s\nLang: %s\nCreated: %s\nID: %s\n\n%s\n",
		msg.Name,
		msg.Email,
		msg.PageURL,
		msg.Lang,
		msg.CreatedAt.Format("2006-01-02 15:04:05 MST"),
		msg.ID,
		msg.Message,
	)
	raw := "" +
		"From: " + from + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"Content-Type: text/plain; charset=UTF-8\r\n" +
		"\r\n" +
		body

	auth := smtp.PlainAuth("", username, password, host)
	return smtp.SendMail(host+":"+port, auth, from, []string{to}, []byte(raw))
}
