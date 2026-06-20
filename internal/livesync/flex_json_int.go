package livesync

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// flexJSONInt unmarshals JSON numbers or numeric strings into an int.
type flexJSONInt int

func (f *flexJSONInt) UnmarshalJSON(b []byte) error {
	b = []byte(strings.TrimSpace(string(b)))
	if len(b) == 0 || string(b) == "null" {
		*f = 0
		return nil
	}
	if b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		s = strings.TrimSpace(s)
		if s == "" || s == "-" {
			*f = 0
			return nil
		}
		n, err := strconv.Atoi(s)
		if err != nil {
			return err
		}
		*f = flexJSONInt(n)
		return nil
	}
	var n float64
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	*f = flexJSONInt(n)
	return nil
}

func (f flexJSONInt) Int() int {
	return int(f)
}

func (f flexJSONInt) String() string {
	if f == 0 {
		return ""
	}
	return strconv.Itoa(int(f))
}

func (f flexJSONInt) GoString() string {
	return fmt.Sprintf("flexJSONInt(%d)", int(f))
}
