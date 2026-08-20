package schedulefile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBuildLastResultsSummary_F2Sessions(t *testing.T) {
	root := findRepoRoot(t)
	body, err := os.ReadFile(filepath.Join(root, "data", "events", "F2", "2026", "f2_2026_7.json"))
	if err != nil {
		t.Skip("f2_2026_7.json not present:", err)
	}
	sum := BuildLastResultsSummaryFromBytes(body, "F2_2026_7", "F2")
	if len(sum.Winners) < 2 {
		t.Fatalf("expected sprint+feature winners, got %#v", sum.Winners)
	}
	for _, w := range sum.Winners {
		if w.Name == "" {
			t.Fatalf("empty winner name: %#v", sum.Winners)
		}
	}
}

func TestBuildLastResultsSummary_SuperFormulaSingleRaceOmitsRoundLabel(t *testing.T) {
	root := findRepoRoot(t)
	body, err := os.ReadFile(filepath.Join(root, "data", "events", "Super Formula", "2026", "super_formula_2026_8.json"))
	if err != nil {
		t.Skip("super_formula_2026_8.json not present:", err)
	}
	sum := BuildLastResultsSummaryFromBytes(body, "SUPER_FORMULA_2026_8", "SUPER_FORMULA")
	if len(sum.Winners) != 1 {
		t.Fatalf("expected 1 SUGO winner, got %#v", sum.Winners)
	}
	if sum.Winners[0].Label != "" {
		t.Fatalf("single-race SF should omit Round label, got %q", sum.Winners[0].Label)
	}
	if sum.Winners[0].Name == "" || sum.Winners[0].Car == "" {
		t.Fatalf("expected named car winner, got %#v", sum.Winners[0])
	}
}

func TestBuildLastResultsSummary_SuperFormulaMultiRaceKeepsRoundLabel(t *testing.T) {
	root := findRepoRoot(t)
	body, err := os.ReadFile(filepath.Join(root, "data", "events", "Super Formula", "2026", "super_formula_2026_6.json"))
	if err != nil {
		t.Skip("super_formula_2026_6.json not present:", err)
	}
	sum := BuildLastResultsSummaryFromBytes(body, "SUPER_FORMULA_2026_6", "SUPER_FORMULA")
	if len(sum.Winners) < 2 {
		t.Fatalf("expected multi-race Fuji winners, got %#v", sum.Winners)
	}
	for _, w := range sum.Winners {
		if w.Label == "" {
			t.Fatalf("multi-race SF should keep Round labels, got %#v", sum.Winners)
		}
	}
}

func TestBuildLastResultsSummary_IndyCarDriver(t *testing.T) {
	root := findRepoRoot(t)
	body, err := os.ReadFile(filepath.Join(root, "data", "events", "IndyCar", "2026", "indycar_2026_5.json"))
	if err != nil {
		t.Skip("indycar_2026_5.json not present:", err)
	}
	sum := BuildLastResultsSummaryFromBytes(body, "INDYCAR_2026_5", "INDYCAR")
	if len(sum.Winners) < 1 || sum.Winners[0].Name == "" {
		t.Fatalf("expected IndyCar winner, got %#v", sum.Winners)
	}
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	wd, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	dir := wd
	for i := 0; i < 6; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("go.mod not found from", wd)
	return ""
}
