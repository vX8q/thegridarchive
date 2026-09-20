package schedulefile

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// CrownJewel is a signature race (Daytona 500, Monaco GP, Indy 500, …).
type CrownJewel struct {
	ID          string   `json:"id"`
	Label       string   `json:"label"`
	LabelRU     string   `json:"label_ru,omitempty"`
	SeriesIDs   []string `json:"series_ids"`
	NameAny     []string `json:"name_any"`
	TrackAny    []string `json:"track_any"`
	NameExclude []string `json:"name_exclude"`
}

type crownJewelFile struct {
	Jewels []CrownJewel `json:"jewels"`
}

var (
	crownJewelsMu    sync.Mutex
	crownJewelsCache []CrownJewel
	crownJewelsDir   string
)

// LoadCrownJewels reads data/crown_jewels.json (memoized per dataDir).
func LoadCrownJewels(dataDir string) []CrownJewel {
	dataDir = strings.TrimSpace(dataDir)
	crownJewelsMu.Lock()
	defer crownJewelsMu.Unlock()
	if crownJewelsCache != nil && crownJewelsDir == dataDir {
		return crownJewelsCache
	}
	path := filepath.Join(dataDir, "crown_jewels.json")
	b, err := os.ReadFile(path) //nolint:gosec
	if err != nil {
		crownJewelsCache = []CrownJewel{}
		crownJewelsDir = dataDir
		return crownJewelsCache
	}
	var file crownJewelFile
	if err := json.Unmarshal(b, &file); err != nil {
		crownJewelsCache = []CrownJewel{}
		crownJewelsDir = dataDir
		return crownJewelsCache
	}
	out := make([]CrownJewel, 0, len(file.Jewels))
	for _, j := range file.Jewels {
		if strings.TrimSpace(j.ID) == "" || len(j.SeriesIDs) == 0 {
			continue
		}
		if len(j.NameAny) == 0 && len(j.TrackAny) == 0 {
			continue
		}
		out = append(out, j)
	}
	crownJewelsCache = out
	crownJewelsDir = dataDir
	return crownJewelsCache
}

func resetCrownJewelsCacheForTest() {
	crownJewelsMu.Lock()
	crownJewelsCache = nil
	crownJewelsDir = ""
	crownJewelsMu.Unlock()
}

func (j CrownJewel) seriesOK(seriesID string) bool {
	want := strings.ToUpper(strings.TrimSpace(seriesID))
	for _, id := range j.SeriesIDs {
		if strings.ToUpper(strings.TrimSpace(id)) == want {
			return true
		}
	}
	return false
}

// Match reports whether this jewel applies to the event.
func (j CrownJewel) Match(seriesID, eventName, circuitName string) bool {
	if !j.seriesOK(seriesID) {
		return false
	}
	name := strings.ToLower(strings.TrimSpace(eventName))
	track := strings.ToLower(strings.TrimSpace(circuitName))
	for _, ex := range j.NameExclude {
		ex = strings.ToLower(strings.TrimSpace(ex))
		if ex != "" && strings.Contains(name, ex) {
			return false
		}
	}
	nameOK := len(j.NameAny) == 0
	for _, p := range j.NameAny {
		p = strings.ToLower(strings.TrimSpace(p))
		if p != "" && strings.Contains(name, p) {
			nameOK = true
			break
		}
	}
	trackOK := len(j.TrackAny) == 0
	for _, p := range j.TrackAny {
		p = strings.ToLower(strings.TrimSpace(p))
		if p == "" {
			continue
		}
		if strings.Contains(track, p) || strings.Contains(name, p) {
			trackOK = true
			break
		}
	}
	return nameOK && trackOK
}
