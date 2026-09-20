package main

import (
	"net/http/httptest"
	"testing"
)

func TestSetWebStaticCacheControl(t *testing.T) {
	cases := []struct {
		path string
		want string
	}{
		{"/web/app.js", "no-store, max-age=0"},
		{"/web/style.css", "no-store, max-age=0"},
		{"/web/pages/event.js", "no-store, max-age=0"},
		{"/web/pages/driver.js", "no-store, max-age=0"},
		{"/web/pages/series.js", "no-store, max-age=0"},
		{"/web/lib/event-race-content.js", "no-store, max-age=0"},
		{"/web/lib/event-entry-list.js", "no-store, max-age=0"},
		{"/web/lib/event-page-helpers.js", "no-store, max-age=0"},
		{"/web/lib/event-card-date.js", "no-store, max-age=0"},
		{"/web/lib/weekend-card-merge.js", "no-store, max-age=0"},
		{"/web/lib/last-results-dates.js", "no-store, max-age=0"},
		{"/web/lib/lazy-assets.js", "no-store, max-age=0"},
		{"/web/lib/router.js", "no-store, max-age=0"},
		{"/web/lib/api.js", "no-store, max-age=0"},
		{"/web/components/last-results-cards.js", "no-store, max-age=0"},
		{"/web/components/next-race-cards.js", "no-store, max-age=0"},
		{"/web/data/translations.js", "no-store, max-age=0"},
		{"/web/spa-boot.js", "no-store, max-age=0"},
		{"/web/pages/list.js", "no-store, max-age=0"},
		{"/web/pages/home-feed.js", "no-store, max-age=0"},
		{"/web/pages/schedule.js", "no-store, max-age=0"},
		{"/web/pages/team.js", "no-store, max-age=0"},
		{"/web/lib/deps.js", "no-store, max-age=0"},
		{"/web/components/table-sort.js", "no-store, max-age=0"},
		{"/web/components/schedule.js", "no-store, max-age=0"},
		{"/web/tga-utils.js", "no-store, max-age=0"},
		{"/web/tga-i18n.js", "no-store, max-age=0"},
		{"/web/data/series-colors.js", "public, max-age=3600"},
		{"/web/images/daytona.jpg", "public, max-age=604800"},
		{"/web/images/madrid-circuit.avif", "public, max-age=604800"},
		{"/web/favicon.svg", "public, max-age=604800"},
	}
	for _, tc := range cases {
		rec := httptest.NewRecorder()
		setWebStaticCacheControl(rec, tc.path)
		got := rec.Header().Get("Cache-Control")
		if got != tc.want {
			t.Fatalf("%s: Cache-Control = %q, want %q", tc.path, got, tc.want)
		}
	}
}
