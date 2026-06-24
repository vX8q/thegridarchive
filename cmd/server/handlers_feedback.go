package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/vX8q/tga/internal/store"
	"github.com/vX8q/tga/models"
)

type feedbackRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Message        string `json:"message"`
	PageURL        string `json:"page_url"`
	Lang           string `json:"lang"`
	Website        string `json:"website"`         // honeypot: real users should leave it empty.
	TurnstileToken string `json:"turnstile_token"` // optional Cloudflare Turnstile token.
}

type feedbackCaptchaVerifier interface {
	VerifyFeedbackCaptcha(r *http.Request, token string) error
}

type noopFeedbackCaptchaVerifier struct{}

func (noopFeedbackCaptchaVerifier) VerifyFeedbackCaptcha(_ *http.Request, _ string) error { return nil }

type turnstileVerifier struct {
	secret string
	client *http.Client
}

func newFeedbackCaptchaVerifier(cfg TurnstileConfig) feedbackCaptchaVerifier {
	if strings.TrimSpace(cfg.SiteKey) == "" || strings.TrimSpace(cfg.SecretKey) == "" {
		return noopFeedbackCaptchaVerifier{}
	}
	return turnstileVerifier{
		secret: strings.TrimSpace(cfg.SecretKey),
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

func (v turnstileVerifier) VerifyFeedbackCaptcha(r *http.Request, token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("missing captcha token")
	}
	form := url.Values{}
	form.Set("secret", v.secret)
	form.Set("response", token)
	if ip := clientIP(r); ip != "" {
		form.Set("remoteip", ip)
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, "https://challenges.cloudflare.com/turnstile/v0/siteverify", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := v.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	var out struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return err
	}
	if !out.Success {
		return errors.New("captcha verification failed")
	}
	return nil
}

var feedbackDuplicateLimiter = newFeedbackDuplicateLimiter(30 * time.Minute)

type feedbackDuplicateLimiterState struct {
	mu   sync.Mutex
	ttl  time.Duration
	seen map[string]time.Time
}

func newFeedbackDuplicateLimiter(ttl time.Duration) *feedbackDuplicateLimiterState {
	return &feedbackDuplicateLimiterState{ttl: ttl, seen: map[string]time.Time{}}
}

func (l *feedbackDuplicateLimiterState) allow(ipHash, message string, now time.Time) bool {
	if l == nil {
		return true
	}
	normalized := strings.ToLower(strings.Join(strings.Fields(message), " "))
	sum := sha256.Sum256([]byte(ipHash + "|" + normalized))
	key := hex.EncodeToString(sum[:])
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, expiresAt := range l.seen {
		if now.After(expiresAt) {
			delete(l.seen, k)
		}
	}
	if expiresAt, ok := l.seen[key]; ok && now.Before(expiresAt) {
		return false
	}
	l.seen[key] = now.Add(l.ttl)
	return true
}

func handleFeedback(w http.ResponseWriter, r *http.Request, st store.Store, notifier feedbackNotifier, captcha feedbackCaptchaVerifier) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req feedbackRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid feedback payload")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Message = strings.TrimSpace(req.Message)
	req.PageURL = strings.TrimSpace(req.PageURL)
	req.Lang = strings.TrimSpace(req.Lang)
	req.Website = strings.TrimSpace(req.Website)
	req.TurnstileToken = strings.TrimSpace(req.TurnstileToken)

	if req.Website != "" {
		// Pretend success so simple spambots do not learn which field caught them.
		writeJSON(w, http.StatusAccepted, map[string]interface{}{"ok": true})
		return
	}
	if captcha != nil {
		if err := captcha.VerifyFeedbackCaptcha(r, req.TurnstileToken); err != nil {
			writeError(w, http.StatusForbidden, "captcha verification failed")
			return
		}
	}
	if req.Message == "" || len([]rune(req.Message)) < 10 {
		writeError(w, http.StatusBadRequest, "message is too short")
		return
	}
	if len([]rune(req.Message)) > 4000 {
		writeError(w, http.StatusBadRequest, "message is too long")
		return
	}
	if len([]rune(req.Name)) > 120 || len([]rune(req.Email)) > 254 || len([]rune(req.PageURL)) > 600 || len([]rune(req.Lang)) > 16 {
		writeError(w, http.StatusBadRequest, "feedback payload is too long")
		return
	}
	if req.Email != "" && !strings.Contains(req.Email, "@") {
		writeError(w, http.StatusBadRequest, "email is invalid")
		return
	}

	ipHash := feedbackIPHash(r)
	now := time.Now().UTC()
	if !feedbackDuplicateLimiter.allow(ipHash, req.Message, now) {
		writeError(w, http.StatusTooManyRequests, "duplicate feedback")
		return
	}

	msg := &models.FeedbackMessage{
		ID:        uuid.NewString(),
		Name:      req.Name,
		Email:     req.Email,
		Message:   req.Message,
		PageURL:   req.PageURL,
		Lang:      req.Lang,
		UserAgent: strings.TrimSpace(r.UserAgent()),
		IPHash:    ipHash,
		Status:    "new",
		CreatedAt: now,
	}
	if err := st.SaveFeedback(r.Context(), msg); err != nil {
		slog.Warn("save feedback failed", "err", err, "trace_id", TraceID(r.Context()))
		writeError(w, http.StatusInternalServerError, "failed to save feedback")
		return
	}
	emailSent := false
	emailStatus := "not_configured"
	if notifier != nil {
		if err := notifier.NotifyFeedback(r.Context(), msg); err != nil {
			if !errors.Is(err, errFeedbackEmailNotConfigured) {
				emailStatus = "failed"
				slog.Warn("send feedback email failed", "err", err, "trace_id", TraceID(r.Context()))
			}
		} else {
			emailSent = true
			emailStatus = "sent"
		}
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{"ok": true, "id": msg.ID, "email_sent": emailSent, "email_status": emailStatus})
}

func feedbackIPHash(r *http.Request) string {
	ip := clientIP(r)
	sum := sha256.Sum256([]byte(ip + "|" + r.UserAgent()))
	return hex.EncodeToString(sum[:])
}

func clientIP(r *http.Request) string {
	ip := r.RemoteAddr
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip = strings.TrimSpace(strings.SplitN(fwd, ",", 2)[0])
	} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		ip = strings.TrimSpace(realIP)
	}
	return ip
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Warn("json encode failed", "err", err)
	}
}
