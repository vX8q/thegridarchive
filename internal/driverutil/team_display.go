package driverutil

import (
	"strings"
	"unicode"
)

var teamAcronyms = map[string]bool{
	"af": true, "tf": true, "ao": true, "am": true, "jr": true, "rfk": true,
	"dgm": true, "wrt": true, "rss": true, "mbm": true, "ecr": true, "rll": true,
	"apr": true, "ck": true, "clx": true, "ccm": true, "bre": true, "dams": true,
	"asp": true, "akm": true, "acr": true, "bmw": true, "wtr": true, "jota": true,
	"gt": true, "mugen": true, "vds": true, "hrc": true, "idec": true, "mks": true,
	"csa": true, "dkr": true, "tds": true, "pr1": true, "jim": true, "mclaren": true,
	"sf": true, "sf23": true, "xi": true, "23xi": true, "aix": true, "as": true,
}

var teamSmallWords = map[string]bool{
	"by": true, "of": true, "with": true, "du": true, "de": true, "la": true,
	"le": true, "et": true, "au": true, "en": true, "and": true, "the": true,
	"for": true, "in": true, "x": true, "y": true, "vs": true,
}

var teamSpecialWords = map[string]string{
	"mclaren": "McLaren",
}

// FormatDisplayTeamName converts ALL CAPS team names to title case while preserving
// acronyms (AF, TF, CLX) and lowercasing small words (by, of, with) after the first word.
// Mixed-case names are returned unchanged.
func FormatDisplayTeamName(name string) string {
	raw := strings.TrimSpace(name)
	if raw == "" || !looksAllCapsTeamName(raw) {
		return raw
	}
	words := strings.Fields(raw)
	out := make([]string, 0, len(words))
	for i, w := range words {
		out = append(out, formatTeamToken(w, i == 0))
	}
	return strings.Join(out, " ")
}

func looksAllCapsTeamName(s string) bool {
	hasLetter := false
	for _, r := range s {
		if unicode.IsLetter(r) {
			hasLetter = true
			if unicode.IsLower(r) {
				return false
			}
		}
	}
	return hasLetter
}

func formatTeamToken(token string, isFirstWord bool) string {
	if token == "" {
		return token
	}
	parts := strings.Split(token, "-")
	for i, part := range parts {
		parts[i] = formatTeamWord(part, isFirstWord && i == 0)
	}
	return strings.Join(parts, "-")
}

func formatTeamWord(word string, isFirstWord bool) string {
	if word == "" {
		return word
	}
	prefix, core, suffix := splitWordPunct(word)
	if core == "" {
		return word
	}
	lower := strings.ToLower(core)
	if special, ok := teamSpecialWords[lower]; ok {
		return prefix + special + suffix
	}
	if teamAcronyms[lower] {
		return prefix + strings.ToUpper(core) + suffix
	}
	if !isFirstWord && teamSmallWords[lower] {
		return prefix + lower + suffix
	}
	if startsWithDigit(core) {
		return prefix + preserveDigitAlphaCase(core) + suffix
	}
	return prefix + strings.ToUpper(core[:1]) + strings.ToLower(core[1:]) + suffix
}

func splitWordPunct(word string) (prefix, core, suffix string) {
	runes := []rune(word)
	start := 0
	for start < len(runes) && !unicode.IsLetter(runes[start]) && !unicode.IsDigit(runes[start]) {
		start++
	}
	end := len(runes)
	for end > start && !unicode.IsLetter(runes[end-1]) && !unicode.IsDigit(runes[end-1]) {
		end--
	}
	if start >= end {
		return "", "", word
	}
	return string(runes[:start]), string(runes[start:end]), string(runes[end:])
}

func startsWithDigit(s string) bool {
	for _, r := range s {
		if unicode.IsDigit(r) {
			return true
		}
		if unicode.IsLetter(r) {
			return false
		}
	}
	return false
}

func preserveDigitAlphaCase(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if unicode.IsLetter(r) && unicode.IsLower(r) {
			b.WriteRune(unicode.ToUpper(r))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
