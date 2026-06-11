# 08 — API Specification

Two surfaces:
- **Supabase (PostgREST + RLS)** for direct authenticated reads/writes the client can do
  safely (profiles, children, saved items, collections, notification prefs, timeline reads).
- **Node/Fastify API** for orchestrated logic (tip selection, daily send, assistant, billing
  webhooks, the SMS webhook). Base URL `https://api.daybyday.app/v1`.

Auth: every Node endpoint (except webhooks) requires `Authorization: Bearer <supabase_jwt>`;
the API verifies the JWT and resolves the parent. Webhooks use provider signatures.

Conventions: JSON; `snake_case`; ISO-8601 timestamps; errors as
`{ "error": { "code": "...", "message": "...", "details": {} } }`; standard HTTP status codes;
idempotency via `Idempotency-Key` header on POSTs that send messages.

---

## 1. Auth & account
Handled by Supabase Auth SDK in-app (email/password, Apple, Google). Node helpers:

### `POST /v1/account/bootstrap`
Creates the `parents` row for a freshly authed user (post-signup).
```jsonc
// body
{ "name": "Sam", "timezone": "America/Denver", "focus_area": "daily_guidance",
  "sms_opt_in": true, "consent_text": "...", "consent_source": "web_signup" }
// 200
{ "parent_id": "uuid", "onboarding_step": "WAITING_CHILD_NAME" }
```

### `GET /v1/me`
Returns parent + children + subscription + notification prefs.

---

## 2. Onboarding
Mirrors the FSM but as discrete calls (app drives the UI; FSM state persisted for SMS parity).

### `POST /v1/children`
```jsonc
{ "name": "Maya", "birthdate": "2025-01-15" }   // or { "due_date": "2026-09-01" }
// 201
{ "id": "uuid", "name": "Maya", "age_days": 512, "stage": "curious_toddler" }
```
### `PATCH /v1/children/:id` · `DELETE /v1/children/:id`
### `POST /v1/onboarding/complete` → sets `ONBOARDED`, triggers first daily card.

---

## 3. Daily feed (the core, engine-backed)

### `GET /v1/feed/today?child_id=:id`
Returns today's selected card for a child (runs/returns the ported selection engine).
```jsonc
// 200
{
  "child_id": "uuid",
  "date": "2026-06-11",
  "tip_id": "daily_concept_content_nb_sleep_001",
  "category": "sleep",
  "stage": "newborn",
  "insight": "Newborn sleep safety is mostly about the sleep environment...",
  "action_tip": "Firm, flat surface; baby on back; keep sleep space clear.",
  "reassurance": "A simple setup is a meaningful safety win—no perfection required.",
  "when_to_consult_doctor": "...",
  "sources": ["..."],
  "saved": false
}
```

### `POST /v1/feed/quick-action`
The 1–6 menu equivalent (another tip / sleep / play / feeding / behavior).
```jsonc
{ "child_id": "uuid", "request_type": "sleep" }   // another_tip|sleep|play|feeding|behavior
// 200 → same card shape; respects cooldown/rotation; logs a `messages` row (channel=in_app)
```
> Free tier: first quick-action/day allowed; subsequent → `402 PAYMENT_REQUIRED` with paywall payload.

### `POST /v1/feed/:tip_id/feedback`  `{ "helpful": true }`  → personalization signal.

---

## 4. Timeline & milestones
### `GET /v1/children/:id/timeline` → stages + current marker + milestones (achieved/upcoming).
### `GET /v1/children/:id/milestones`
### `POST /v1/children/:id/milestones`
```jsonc
{ "milestone_key": "first_roll", "achieved_on": "2026-06-01", "note": "on the playmat!" }
```
### `PATCH /v1/milestones/:id` · `DELETE /v1/milestones/:id`

---

## 5. Saved content & collections
`GET/POST/DELETE /v1/saved` · `GET/POST /v1/collections` ·
`POST/DELETE /v1/collections/:id/items` · `PATCH /v1/saved/:id` (note).
`GET /v1/export/keepsake?child_id=:id` → PDF (Premium) — preserves the `Docs.js` keepsake.

---

## 6. Assistant (Phase 3)
### `POST /v1/assistant/threads` → `{ "thread_id": "uuid" }` (optional `child_id`).
### `POST /v1/assistant/messages` (streaming, SSE)
```jsonc
{ "thread_id": "uuid", "child_id": "uuid", "content": "Maya keeps waking at 4am, help?" }
```
Pipeline: safety pre-check → personalization context → RAG retrieval → Claude (grounded) →
safety post-check → stream. Response includes `citations[]` and `safety_flag`. Red-flag inputs
return a `safety_flag: "escalated"` "seek care" message and skip generation.
> Free tier → `402` paywall on first question.

---

## 7. Notifications
### `POST /v1/push/register`  `{ "expo_token": "...", "platform": "ios" }`
### `GET/PATCH /v1/notifications/prefs` (channels, quiet hours, per-child).

---

## 8. Billing
### `GET /v1/billing/plans`
### `POST /v1/billing/checkout`  `{ "plan": "premium", "period": "annual", "platform": "web" }` → Stripe URL.
### `POST /v1/webhooks/revenuecat` · `POST /v1/webhooks/stripe` (signature-verified) → upsert `subscriptions`.

---

## 9. SMS leg (legacy parity + bridge)
### `POST /v1/webhooks/sms` (Twilio; **signature-validated** — fixes audit R1)
Body = Twilio form (`From`, `Body`, …). Routes STOP/HELP/START + onboarding + menu replies
through the **same engine** as the app. TCPA preserved. Replies sent via Twilio REST.

### Cron (internal, not public)
- **Daily send** — for each due parent (local preferred time, not yet sent today): select via
  engine, fan out push + opted-in SMS, write idempotent `messages` row.
- **Notification fan-out**, **weekly digest email**, **milestone nudges**.

---

## 10. Privacy / account management
### `GET /v1/privacy/export` → full data export (GDPR/CCPA).
### `DELETE /v1/account` → soft-delete + purge job. `GET /v1/consents` → audit history.

---

## 11. Errors (catalog)
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHENTICATED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Not this family's resource (RLS) / bad webhook signature |
| `PAYMENT_REQUIRED` | 402 | Feature gated to Premium/Family (carries paywall payload) |
| `NOT_FOUND` | 404 | |
| `VALIDATION` | 422 | Bad input (Zod) |
| `RATE_LIMITED` | 429 | |
| `SAFETY_ESCALATED` | 200 | Assistant returned a safety response (not an error, but flagged) |
| `INTERNAL` | 500 | |

Shared **Zod schemas** define request/response types, imported by both the Node API and the
Expo app (single source of truth — a key reason for the TS stack).
