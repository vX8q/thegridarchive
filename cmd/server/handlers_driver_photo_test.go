package main

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestResolveLocalDriverPhotoPathAllowsWebDrivers(t *testing.T) {
	repo := t.TempDir()
	dataDir := filepath.Join(repo, "data")
	want := filepath.Join(repo, "web", "drivers", "alex-palou.jpg")
	if err := os.MkdirAll(filepath.Dir(want), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(want, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	got, ok := resolveLocalDriverPhotoPath("/web/drivers/alex-palou.jpg", dataDir)
	if !ok {
		t.Fatal("expected /web/drivers path to be allowed")
	}
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	got, ok = resolveLocalDriverPhotoPath("web/drivers/alex%20palou.png", dataDir)
	if !ok {
		t.Fatal("expected web/drivers percent-encoded path to be allowed")
	}
	wantPNG := filepath.Join(repo, "web", "drivers", "alex palou.png")
	if got != wantPNG {
		t.Fatalf("got %q, want %q", got, wantPNG)
	}
}

func TestResolveLocalDriverPhotoPathRejectsTraversalAndAbs(t *testing.T) {
	repo := t.TempDir()
	dataDir := filepath.Join(repo, "data")
	cases := []string{
		"/web/drivers/../secret.jpg",
		"web/../data/secret.png",
		"/etc/passwd.jpg",
		"C:\\Windows\\system32\\config.png",
		"data/drivers/foo.jpg",
		"/web/drivers/foo.txt",
	}
	for _, c := range cases {
		if _, ok := resolveLocalDriverPhotoPath(c, dataDir); ok {
			t.Fatalf("expected reject for %q", c)
		}
	}
	if runtime.GOOS == "windows" {
		if _, ok := resolveLocalDriverPhotoPath(`C:\Users\evil\photo.jpg`, dataDir); ok {
			t.Fatal("absolute Windows path should be rejected")
		}
	}
}

func TestIsLocalDriverPhotoRejectsAbsOnly(t *testing.T) {
	if isLocalDriverPhoto(`/tmp/evil.jpg`) {
		t.Fatal("absolute path alone must not be treated as local driver photo")
	}
	if !isLocalDriverPhoto("/web/drivers/a.jpg") {
		t.Fatal("expected /web/drivers to be local")
	}
}
