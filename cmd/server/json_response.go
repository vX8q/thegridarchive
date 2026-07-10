package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

func writeSeriesJSONCached(w http.ResponseWriter, cacheKey string, sourceMtime time.Time, v any) {
	if body, ok := seriesResponseCache.Get(cacheKey, sourceMtime); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "private, max-age=30")
		_, _ = w.Write(body)
		return
	}
	body, err := json.Marshal(v)
	if err != nil {
		slog.Warn("json marshal failed", "cache_key", cacheKey, "err", err)
		writeError(w, http.StatusInternalServerError, "failed to encode response")
		return
	}
	seriesResponseCache.Set(cacheKey, sourceMtime, body)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "private, max-age=30")
	_, _ = w.Write(body)
}
