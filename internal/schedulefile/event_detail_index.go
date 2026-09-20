package schedulefile

import (
	"io/fs"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var eventDetailFileSet struct {
	mu    sync.RWMutex
	mtime int64 // unix nano of EventsTreeMaxMtime
	ids   map[string]struct{}
}

var eventsTreeMtimeMemo struct {
	mu      sync.Mutex
	dataDir string
	value   time.Time
	expires time.Time
}

const eventsTreeMtimeTTL = 2 * time.Second

// ClearEventsTreeMtimeMemoForTest drops the short-lived mtime memo (tests only).
func ClearEventsTreeMtimeMemoForTest() {
	eventsTreeMtimeMemo.mu.Lock()
	eventsTreeMtimeMemo.dataDir = ""
	eventsTreeMtimeMemo.value = time.Time{}
	eventsTreeMtimeMemo.expires = time.Time{}
	eventsTreeMtimeMemo.mu.Unlock()
}

// EventsTreeMaxMtime is the latest mod time of any event JSON under data/events/.
// Results are memoized briefly to avoid walking the tree on every /api/schedule request.
func EventsTreeMaxMtime(dataDir string) (latest time.Time) {
	now := time.Now()
	eventsTreeMtimeMemo.mu.Lock()
	if eventsTreeMtimeMemo.dataDir == dataDir && now.Before(eventsTreeMtimeMemo.expires) {
		latest = eventsTreeMtimeMemo.value
		eventsTreeMtimeMemo.mu.Unlock()
		return latest
	}
	eventsTreeMtimeMemo.mu.Unlock()

	latest = walkEventsTreeMaxMtime(dataDir)

	eventsTreeMtimeMemo.mu.Lock()
	eventsTreeMtimeMemo.dataDir = dataDir
	eventsTreeMtimeMemo.value = latest
	eventsTreeMtimeMemo.expires = now.Add(eventsTreeMtimeTTL)
	eventsTreeMtimeMemo.mu.Unlock()
	return latest
}

func walkEventsTreeMaxMtime(dataDir string) (latest time.Time) {
	root := filepath.Join(dataDir, "events")
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(strings.ToLower(path), ".json") {
			return nil
		}
		info, infoErr := d.Info()
		if infoErr == nil && info.ModTime().After(latest) {
			latest = info.ModTime()
		}
		return nil
	})
	return latest
}

func refreshEventDetailFileSet(dataDir string) map[string]struct{} {
	mtime := EventsTreeMaxMtime(dataDir)
	eventDetailFileSet.mu.RLock()
	if eventDetailFileSet.ids != nil && eventDetailFileSet.mtime == mtime.UnixNano() {
		out := eventDetailFileSet.ids
		eventDetailFileSet.mu.RUnlock()
		return out
	}
	eventDetailFileSet.mu.RUnlock()

	ids := make(map[string]struct{})
	var latest time.Time
	root := filepath.Join(dataDir, "events")
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(strings.ToLower(path), ".json") {
			return nil
		}
		info, infoErr := d.Info()
		if infoErr == nil && info.ModTime().After(latest) {
			latest = info.ModTime()
		}
		base := strings.TrimSuffix(strings.ToLower(filepath.Base(path)), ".json")
		if base != "" {
			ids[base] = struct{}{}
		}
		return nil
	})

	// Keep memo in sync with the walk we just did.
	eventsTreeMtimeMemo.mu.Lock()
	eventsTreeMtimeMemo.dataDir = dataDir
	eventsTreeMtimeMemo.value = latest
	eventsTreeMtimeMemo.expires = time.Now().Add(eventsTreeMtimeTTL)
	eventsTreeMtimeMemo.mu.Unlock()

	eventDetailFileSet.mu.Lock()
	eventDetailFileSet.mtime = latest.UnixNano()
	eventDetailFileSet.ids = ids
	eventDetailFileSet.mu.Unlock()
	return ids
}

// EventDetailFileSet returns the cached set of on-disk event JSON ids (lowercase stems).
func EventDetailFileSet(dataDir string) map[string]struct{} {
	return refreshEventDetailFileSet(dataDir)
}

// EventHasDetail reports whether detail JSON exists for a schedule event id.
func EventHasDetail(dataDir string, fileSet map[string]struct{}, scheduleEventID string) bool {
	if fileSet == nil {
		fileSet = EventDetailFileSet(dataDir)
	}
	resolved := strings.ToLower(strings.TrimSpace(ResolveEventDetailID(dataDir, scheduleEventID)))
	if resolved == "" {
		return false
	}
	_, ok := fileSet[resolved]
	return ok
}
