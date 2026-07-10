package main

import "testing"

func TestConfigValidate_TurnstileRequiredWithSMTP(t *testing.T) {
	cfg := Config{
		Port: "8080",
		FeedbackSMTP: FeedbackSMTPConfig{
			Host:     "smtp.gmail.com",
			Port:     "587",
			Username: "user@example.com",
			Password: "secret",
			From:     "user@example.com",
			To:       "ops@example.com",
		},
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error when SMTP configured without Turnstile")
	}
}

func TestConfigValidate_TurnstilePairRequired(t *testing.T) {
	cfg := Config{
		Port:      "8080",
		Turnstile: TurnstileConfig{SiteKey: "site-only"},
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected error when only site key is set")
	}
}

func TestConfigValidate_SMTPWithTurnstileOK(t *testing.T) {
	cfg := Config{
		Port: "8080",
		FeedbackSMTP: FeedbackSMTPConfig{
			Host:     "smtp.gmail.com",
			Username: "user@example.com",
			Password: "secret",
			From:     "user@example.com",
			To:       "ops@example.com",
		},
		Turnstile: TurnstileConfig{
			SiteKey:   "site",
			SecretKey: "secret",
		},
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate: %v", err)
	}
}
