package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	_ "golang.org/x/image/webp"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/image/draw"
)

const (
	cardBgOutW     = 640
	cardBgOutH     = 270
	cardBgJPEGQual = 92
)

var cardBgMu sync.Mutex

func handleCardBackground(w http.ResponseWriter, r *http.Request, webDir, dataDir string) {
	name := strings.TrimPrefix(r.URL.Path, "/api/card-bg/")
	name = strings.TrimSpace(strings.TrimRight(name, "/"))
	if name == "" || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
	default:
		http.NotFound(w, r)
		return
	}

	srcPath := filepath.Join(webDir, "images", filepath.FromSlash(name))
	srcInfo, err := os.Stat(srcPath)
	if err != nil || srcInfo.IsDir() {
		http.NotFound(w, r)
		return
	}

	cacheDir := filepath.Join(dataDir, "cache", "card_bg")
	cacheKey := sha256.Sum256([]byte(fmt.Sprintf("%s|%d|v1", name, srcInfo.ModTime().UnixNano())))
	cachePath := filepath.Join(cacheDir, hex.EncodeToString(cacheKey[:])+".jpg")

	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		serveCardBgJPEG(w, b)
		return
	}

	cardBgMu.Lock()
	defer cardBgMu.Unlock()
	if b, err := os.ReadFile(cachePath); err == nil && len(b) > 0 { //nolint:gosec
		serveCardBgJPEG(w, b)
		return
	}

	f, err := os.Open(srcPath) //nolint:gosec
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer func() { _ = f.Close() }()

	src, _, err := image.Decode(f)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	bounds := src.Bounds()
	srcW, srcH := bounds.Dx(), bounds.Dy()
	if srcW <= 0 || srcH <= 0 {
		http.NotFound(w, r)
		return
	}

	out := renderCardBackgroundCover(src, bounds, cardBgOutW, cardBgOutH)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, out, &jpeg.Options{Quality: cardBgJPEGQual}); err != nil {
		http.NotFound(w, r)
		return
	}
	if err := os.MkdirAll(cacheDir, 0o750); err == nil {
		_ = os.WriteFile(cachePath, buf.Bytes(), 0o600)
	}
	serveCardBgJPEG(w, buf.Bytes())
}

func serveCardBgJPEG(w http.ResponseWriter, b []byte) {
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "public, max-age=604800, immutable")
	_, _ = io.Copy(w, bytes.NewReader(b))
}

func renderCardBackgroundCover(src image.Image, bounds image.Rectangle, outW, outH int) *image.RGBA {
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	scale := math.Max(float64(outW)/float64(srcW), float64(outH)/float64(srcH))
	scaledW := int(math.Ceil(float64(srcW) * scale))
	scaledH := int(math.Ceil(float64(srcH) * scale))
	if scaledW < 1 {
		scaledW = 1
	}
	if scaledH < 1 {
		scaledH = 1
	}

	scaled := image.NewRGBA(image.Rect(0, 0, scaledW, scaledH))
	draw.CatmullRom.Scale(scaled, scaled.Bounds(), src, bounds, draw.Over, nil)

	dst := image.NewRGBA(image.Rect(0, 0, outW, outH))
	cropX := (scaledW - outW) / 2
	cropY := (scaledH - outH) / 2
	draw.Draw(dst, dst.Bounds(), scaled, image.Point{X: cropX, Y: cropY}, draw.Src)
	return dst
}
