package main

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds server settings from env vars and defaults.
type Config struct {
	DataDir       string
	WebDir        string
	Port          string
	ResetDB       bool
	EnableAdmin   bool
	AdminToken    string  // secret for /api/admin/* (X-Admin-Token or Authorization: Bearer <token>)
	RateLimitRPS  float64 // requests per second per IP (0 = no limit)
	EnablePprof   bool    // enable /debug/pprof* (dev/staging only)
}

// LoadConfig reads config from environment variables (defaults: port 8080, reset_db and admin disabled).
func LoadConfig() Config {
	cfg := Config{
		DataDir:      "",
		WebDir:       "web",
		Port:         "8080",
		ResetDB:      false,
		EnableAdmin:  false,
		EnablePprof:  false,
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
