package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vX8q/tga/internal/store"
)

func TestHandleFeedbackStoresMessage(t *testing.T) {
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()

	body := map[string]string{
		"name":     "Tester",
		"email":    "tester@example.com",
		"message":  "Please fix a missing race result.",
		"page_url": "http://example.test/feedback",
		"lang":     "en",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	handleFeedback(rr, req, st, noopFeedbackNotifier{}, noopFeedbackCaptchaVerifier{})

	if rr.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}
	var response map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response["email_sent"] != false {
		t.Fatalf("email_sent = %#v, want false", response["email_sent"])
	}
	if response["email_status"] != "not_configured" {
		t.Fatalf("email_status = %#v, want not_configured", response["email_status"])
	}

	var count int
	if err := st.DB().QueryRow(`SELECT COUNT(*) FROM feedback_messages WHERE email = ?`, "tester@example.com").Scan(&count); err != nil {
		t.Fatalf("query feedback_messages: %v", err)
	}
	if count != 1 {
		t.Fatalf("feedback row count = %d, want 1", count)
	}
}

func TestHandleFeedbackHoneypotPretendsSuccess(t *testing.T) {
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()

	body := map[string]string{
		"message": "Spam bot filled the hidden field.",
		"website": "https://spam.example",
	}
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewReader(b))
	rr := httptest.NewRecorder()

	handleFeedback(rr, req, st, noopFeedbackNotifier{}, noopFeedbackCaptchaVerifier{})

	if rr.Code != http.StatusAccepted {
		t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
	}

	var count int
	err = st.DB().QueryRow(`SELECT COUNT(*) FROM feedback_messages`).Scan(&count)
	if err != nil && err != sql.ErrNoRows {
		t.Fatalf("query feedback_messages: %v", err)
	}
	if count != 0 {
		t.Fatalf("feedback row count = %d, want 0", count)
	}
}

func TestHandleFeedbackDuplicateMessageIsLimited(t *testing.T) {
	feedbackDuplicateLimiter = newFeedbackDuplicateLimiter(30 * time.Minute)
	st, err := store.NewSQLiteStore(":memory:")
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	defer func() { _ = st.Close() }()

	body := map[string]string{
		"message": "The same detailed feedback message should be limited.",
	}
	b, _ := json.Marshal(body)

	req1 := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewReader(b))
	rr1 := httptest.NewRecorder()
	handleFeedback(rr1, req1, st, noopFeedbackNotifier{}, noopFeedbackCaptchaVerifier{})
	if rr1.Code != http.StatusCreated {
		t.Fatalf("first status = %d, body = %s", rr1.Code, rr1.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodPost, "/api/feedback", bytes.NewReader(b))
	rr2 := httptest.NewRecorder()
	handleFeedback(rr2, req2, st, noopFeedbackNotifier{}, noopFeedbackCaptchaVerifier{})
	if rr2.Code != http.StatusTooManyRequests {
		t.Fatalf("second status = %d, want %d; body = %s", rr2.Code, http.StatusTooManyRequests, rr2.Body.String())
	}
}
