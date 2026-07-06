package schedulefile

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestStandingRowQualsJSONRoundtrip(t *testing.T) {
	in := StandingsData{
		Classes: []StandingsClass{{
			ID: "GTP",
			Rows: []StandingRow{{
				Pos:    1,
				Car:    "31",
				Driver: "Jack Aitken / Earl Bamber",
				Points: "1760",
				Races:  map[string]string{"DET": "1"},
				Quals:  map[string]string{"DET": "1", "MON": "2"},
			}},
		}},
	}
	b, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(b), `"quals"`) {
		t.Fatalf("marshaled JSON missing quals key: %s", string(b))
	}
	var out StandingsData
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(out.Classes) != 1 || len(out.Classes[0].Rows) != 1 {
		t.Fatalf("unexpected structure: %#v", out.Classes)
	}
	q := out.Classes[0].Rows[0].Quals
	if q["DET"] != "1" || q["MON"] != "2" {
		t.Fatalf("quals roundtrip = %#v", q)
	}
}
