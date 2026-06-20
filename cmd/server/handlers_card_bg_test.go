package main

import (
	"image"
	"image/color"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestRenderCardBackgroundCoverDimensions(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 2000, 1000))
	for y := 0; y < 1000; y++ {
		for x := 0; x < 2000; x++ {
			src.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 40, A: 255})
		}
	}
	out := renderCardBackgroundCover(src, src.Bounds(), cardBgOutW, cardBgOutH)
	if out.Bounds().Dx() != cardBgOutW || out.Bounds().Dy() != cardBgOutH {
		t.Fatalf("got %dx%d, want %dx%d", out.Bounds().Dx(), out.Bounds().Dy(), cardBgOutW, cardBgOutH)
	}
}

func TestHandleCardBackgroundWebPMisnamedAsJPEG(t *testing.T) {
	webDir := filepath.Join("..", "..", "web")
	req := httptest.NewRequest(http.MethodGet, "/api/card-bg/Circuit-de-la-Sarthe.jpg", nil)
	rr := httptest.NewRecorder()
	handleCardBackground(rr, req, webDir, t.TempDir())
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Fatalf("content-type = %q, want image/jpeg", ct)
	}
	if rr.Body.Len() < 100 {
		t.Fatalf("body too small: %d bytes", rr.Body.Len())
	}
}

func TestHandleCardBackgroundRejectsTraversal(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/card-bg/../secret.jpg", nil)
	rr := httptest.NewRecorder()
	handleCardBackground(rr, req, t.TempDir(), t.TempDir())
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rr.Code)
	}
}
