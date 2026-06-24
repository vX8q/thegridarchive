package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds server settings from env vars and defaults.
type Config struct {
	DataDir      string
	WebDir       string
	Port         string
	ResetDB      bool
	EnableAdmin  bool
	AdminToken   string  // secret for /api/admin/* (X-Admin-Token or Authorization: Bearer <token>)
	RateLimitRPS float64 // requests per second per IP (0 = no limit)
	EnablePprof  bool    // enable /debug/pprof* (dev/staging only)
	FeedbackSMTP FeedbackSMTPConfig
	Turnstile    TurnstileConfig
}

// FeedbackSMTPConfig controls optional email notifications for feedback submissions.
type FeedbackSMTPConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
	To       string
}

// TurnstileConfig controls optional Cloudflare Turnstile checks for feedback.
type TurnstileConfig struct {
	SiteKey   string
	SecretKey string
}

// LoadConfig reads config from environment variables (defaults: port 8080, reset_db and admin disabled).
func LoadConfig() Config {
	loadDotEnv(".env")
	cfg := Config{
		DataDir:     "",
		WebDir:      "web",
		Port:        "8080",
		ResetDB:     false,
		EnableAdmin: false,
		EnablePprof: false,
	}
	if v := os.Getenv("TGA_DATA"); v != "" {
		cfg.DataDir = v
	}
	if v := os.Getenv("TGA_WEB"); v != "" {
		cfg.WebDir = v
	}
	if v := os.Getenv("PORT"); v != "" {
		if _, err := strconv.Atoi(v); err == nil {
			cfg.Port = v
		}
	}
	cfg.ResetDB = os.Getenv("TGA_RESET_DB_ON_START") == "1"
	cfg.EnableAdmin = os.Getenv("TGA_ENABLE_ADMIN") == "1"
	cfg.EnablePprof = os.Getenv("TGA_ENABLE_PPROF") == "1"
	if v := os.Getenv("TGA_ADMIN_TOKEN"); v != "" {
		cfg.AdminToken = v
	}
	if v := os.Getenv("TGA_RATE_LIMIT_RPS"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f > 0 {
			cfg.RateLimitRPS = f
		}
	}
	cfg.FeedbackSMTP = FeedbackSMTPConfig{
		Host:     envOrDefault("TGA_FEEDBACK_SMTP_HOST", "smtp.gmail.com"),
		Port:     envOrDefault("TGA_FEEDBACK_SMTP_PORT", "587"),
		Username: os.Getenv("TGA_FEEDBACK_SMTP_USER"),
		Password: os.Getenv("TGA_FEEDBACK_SMTP_PASS"),
		From:     os.Getenv("TGA_FEEDBACK_FROM"),
		To:       envOrDefault("TGA_FEEDBACK_TO", "bobbtga@gmail.com"),
	}
	if cfg.FeedbackSMTP.Username == "" && cfg.FeedbackSMTP.Password != "" {
		cfg.FeedbackSMTP.Username = cfg.FeedbackSMTP.To
	}
	if cfg.FeedbackSMTP.From == "" {
		cfg.FeedbackSMTP.From = cfg.FeedbackSMTP.Username
	}
	cfg.Turnstile = TurnstileConfig{
		SiteKey:   os.Getenv("TGA_TURNSTILE_SITE_KEY"),
		SecretKey: os.Getenv("TGA_TURNSTILE_SECRET_KEY"),
	}
	return cfg
}

// Validate checks config consistency and returns an error for invalid values.
func (c Config) Validate() error {
	if _, err := strconv.Atoi(c.Port); err != nil {
		return fmt.Errorf("invalid port %q: %w", c.Port, err)
	}
	if c.EnableAdmin && c.AdminToken == "" {
		return fmt.Errorf("TGA_ENABLE_ADMIN=1 but TGA_ADMIN_TOKEN is empty")
	}
	return nil
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer func() { _ = f.Close() }()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		value = strings.Trim(value, `"'`)
		_ = os.Setenv(key, value)
	}
}
