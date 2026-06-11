// Package main provides the HTTP server entrypoints and handlers.
package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// writeError sends a JSON response with an "error" field and the given HTTP status.
// Used by all API handlers for consistent error handling.
func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body := map[string]string{"error": message}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Warn("writeError: failed to encode body", "err", err)
	}
}
