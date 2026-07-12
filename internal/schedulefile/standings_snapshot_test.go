package schedulefile

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// standingsTopFingerprint hashes stable top-N driver points for regression detection.
func standingsTopFingerprint(data *StandingsData, topN int) string {
	if data == nil {
		return ""
	}
	var parts []string
	parts = append(parts, fmt.Sprintf("races=%d", len(data.RaceOrder)))
	parts = append(parts, fmt.Sprintf("completed=%d", len(data.CompletedRaces)))
	n := topN
	if n > len(data.Rows) {
		n = len(data.Rows)
	}
	for i := 0; i < n; i++ {
		row := data.Rows[i]
		parts = append(parts, fmt.Sprintf("%d:%s:%s", row.Pos, row.Driver, row.Points))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}

func elmsClassFingerprint(data *StandingsData) string {
	if data == nil || len(data.Classes) == 0 {
		return ""
	}
	var parts []string
	for _, cls := range data.Classes {
		parts = append(parts, cls.ID)
		if len(cls.Rows) > 0 {
			r := cls.Rows[0]
			parts = append(parts, fmt.Sprintf("%d:%s:%s", r.Pos, r.Driver, r.Points))
		}
	}
	sort.Strings(parts)
	sum := sha256.Sum256([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])
}

func TestStandingsSnapshot_CupF1ELMS(t *testing.T) {
	dataDir, err := filepath.Abs(filepath.Join("..", "..", "data"))
	if err != nil {
		t.Fatalf("abs data dir: %v", err)
	}

	cup, err := BuildStandingsFromEvents(dataDir, "NASCAR_CUP", "2026")
	if err != nil {
		t.Fatalf("cup build: %v", err)
	}
	if len(cup.Rows) < 30 {
		t.Fatalf("cup rows = %d, want >= 30", len(cup.Rows))
	}
	cupFP := standingsTopFingerprint(cup, 5)
	t.Logf("cup standings fingerprint (top 5): %s", cupFP)
	hasDay := false
	for _, code := range cup.RaceOrder {
		if code == "DAY" {
			hasDay = true
			break
		}
	}
	if !hasDay {
		t.Fatalf("cup race_order missing DAY: %v", cup.RaceOrder[:min(8, len(cup.RaceOrder))])
	}

	f1, err := BuildStandingsFromEvents(dataDir, "F1", "2026")
	if err != nil {
		t.Fatalf("f1 build: %v", err)
	}
	var ant *StandingRow
	for i := range f1.Rows {
		if f1.Rows[i].Driver == "Kimi Antonelli" {
			ant = &f1.Rows[i]
			break
		}
	}
	if ant == nil {
		t.Fatal("F1 snapshot: Kimi Antonelli missing")
	}
	if ant.Races["R5F"] != "1" || ant.Races["R6"] != "1" {
		t.Fatalf("F1 Antonelli R5F/R6 = %q/%q", ant.Races["R5F"], ant.Races["R6"])
	}
	f1FP := standingsTopFingerprint(f1, 5)
	t.Logf("f1 standings fingerprint (top 5): %s", f1FP)

	elms, err := BuildElmsStandingsFromEvents(dataDir, "2026")
	if err != nil {
		t.Fatalf("elms build: %v", err)
	}
	if len(elms.Classes) == 0 {
		t.Fatal("ELMS snapshot: no classes")
	}
	var lmp2 *StandingsClass
	for i := range elms.Classes {
		if elms.Classes[i].ID == "LMP2" {
			lmp2 = &elms.Classes[i]
			break
		}
	}
	if lmp2 == nil || len(lmp2.Rows) == 0 {
		t.Fatal("ELMS LMP2 class missing")
	}
	if lmp2.Rows[0].Races["BAR"] == "" {
		t.Errorf("ELMS LMP2 leader missing BAR: %#v", lmp2.Rows[0].Races)
	}
	elmsFP := elmsClassFingerprint(elms)
	t.Logf("elms class fingerprint: %s", elmsFP)

	for label, fp := range map[string]string{"cup": cupFP, "f1": f1FP, "elms": elmsFP} {
		if len(fp) != 64 {
			t.Fatalf("%s fingerprint invalid: %q", label, fp)
		}
	}
}
