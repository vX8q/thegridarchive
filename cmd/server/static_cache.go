package main

import (
	"net/http"
	"path"
	"strings"
)

// setWebStaticCacheControl sets Cache-Control for /web/* assets.
// Hot-edited entrypoints stay no-store; everything else gets a short public TTL.
func setWebStaticCacheControl(w http.ResponseWriter, urlPath string) {
	p := path.Clean("/" + strings.TrimPrefix(urlPath, "/"))
	switch p {
	case "/web/app.js", "/web/style.css", "/web/index.html",
		"/web/pages/event.js", "/web/pages/driver.js", "/web/pages/series.js",
		"/web/pages/list.js", "/web/pages/home-feed.js", "/web/pages/schedule.js", "/web/pages/team.js",
		"/web/lib/event-race-content.js",
		"/web/lib/event-entry-list.js",
		"/web/lib/event-page-helpers.js", "/web/lib/event-card-date.js",
		"/web/lib/weekend-card-merge.js", "/web/lib/last-results-dates.js",
		"/web/lib/lazy-assets.js", "/web/lib/router.js", "/web/lib/api.js", "/web/lib/deps.js",
		"/web/components/last-results-cards.js", "/web/components/next-race-cards.js",
		"/web/components/schedule.js", "/web/components/table-sort.js",
		"/web/components/series-schedule-expand.js",
		"/web/data/translations.js", "/web/spa-boot.js",
		"/web/tga-utils.js", "/web/tga-i18n.js":
		w.Header().Set("Cache-Control", "no-store, max-age=0")
		return
	}
	ext := strings.ToLower(path.Ext(p))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico", ".woff", ".woff2", ".avif":
		w.Header().Set("Cache-Control", "public, max-age=604800")
	case ".js", ".css", ".map":
		w.Header().Set("Cache-Control", "public, max-age=3600")
	default:
		w.Header().Set("Cache-Control", "public, max-age=300")
	}
}
