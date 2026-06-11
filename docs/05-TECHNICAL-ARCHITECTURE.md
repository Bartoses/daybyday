# 05 — Technical Architecture

## 1. Recommended stack (summary)

| Layer | Choice | Why |
|-------|--------|-----|
| **Mobile + Web** | **Expo (React Native) + Expo Router** | One codebase → iOS, Android, **and web**. OTA updates. Largest hiring pool. Web parity is first-class (RN-Web). |
| **Backend API** | **Node + TypeScript (Fastify)** on Railway/Fly | Team already runs Node/Express on Railway (Highmark). Shared ops knowledge. Typed end-to-end with the app. |
| **Database** | **Supabase Postgres** | Managed Postgres + Auth + Storage + Realtime + RLS in one. Replaces Sheets cleanly; SQL relational fit for parents/children/content/messages. |
| **Auth** | **Supabase Auth** (email/password, Apple, Google) | Native social sign-in; JWT the API verifies; RLS keys off `auth.uid()`. |
| **Push** | **Expo Push** (→ APNs/FCM) | Zero-config with Expo; one API for both platforms. |
| **SMS** | **Twilio** (retained) | Keep the legacy leg; add signature validation. |
| **Email** | **Resend** (or Postmark) | Transactional + weekly digest. |
| **AI** | **Claude API** (`claude-opus-4-8` reasoning, `claude-haiku-4-5` low-latency) + **pgvector** for RAG | Best-in-class; team already integrates Claude. pgvector keeps retrieval in the same Postgres. |
| **Analytics** | **PostHog** (product) + Sentry (errors) | Funnels, retention cohorts, session replay; self-hostable. |
| **Scheduling** | Supabase **pg_cron** / a small worker (Railway cron) | Daily-send + notification fan-out; mirrors the proven cron-worker pattern from Highmark. |
| **Payments** | **RevenueCat** (mobile IAP) + Stripe (web) | Cross-platform subscriptions, entitlements, server receipts. |
| **CI/CD** | GitHub Actions + EAS Build/Submit | App builds + store submission; backend deploy on push. |

## 2. Mobile framework decision — React Native (Expo) vs Flutter

| Dimension | React Native (Expo) ✅ | Flutter |
|-----------|----------------------|---------|
| iOS + Android + **Web** | First-class via RN-Web/Expo Router | Web exists but weaker for content/SEO/text apps |
| Team fit | JS/TS already in use (Highmark, Node) — **shared language across app + backend** | Dart is a new language for this team |
| OTA updates | Expo Updates (ship JS fixes without store review) | Limited |
| Hiring pool | Very large | Smaller |
| Ecosystem (auth, push, payments, AI SDKs) | Mature JS SDKs (Supabase, RevenueCat, PostHog, Anthropic) | Good, but more bridging |
| Raw UI performance | Excellent for a content/feed app | Slightly better for heavy custom animation/games (not our need) |
| Backend code-sharing | **Share types/validation (Zod) between app and Node API** | None |

**Recommendation: Expo / React Native.** The deciding factors are (1) true web parity for a
text/content product, (2) a single TypeScript stack from app to backend (shared Zod schemas,
shared validation), and (3) the team's existing JS/Node/Supabase/Claude experience. Flutter's
edge (custom-animation performance) doesn't apply to a calm content app.

## 3. System architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Clients: Expo app (iOS / Android / Web)                     │
│   - Supabase Auth (JWT)                                      │
│   - Direct Supabase reads via RLS (feed, profiles, saved)    │
│   - API calls for orchestrated actions (tip select, assistant)│
└───────────────┬───────────────────────────┬─────────────────┘
                │                            │
       (RLS, JWT)│                            │ (JWT-verified REST)
                ▼                            ▼
        ┌───────────────┐          ┌──────────────────────────┐
        │ Supabase       │          │ Node/Fastify API          │
        │  Postgres+RLS  │◄────────►│  - /feed (tip selection)  │
        │  Auth, Storage │          │  - /assistant (Claude+RAG)│
        │  pgvector      │          │  - /notifications         │
        │  pg_cron       │          │  - /sms (Twilio webhook)  │
        └───────────────┘          │  - /billing (RevenueCat)  │
                ▲                   └───────────┬──────────────┘
                │                               │
        ┌───────┴────────┐        ┌────────────┴───────────────┐
        │ Cron worker     │        │ External: Claude API,      │
        │  - daily send   │        │ Twilio, Expo Push, Resend, │
        │  - notif fan-out│        │ RevenueCat/Stripe, PostHog │
        │  - digest       │        └────────────────────────────┘
        └─────────────────┘
```

### Read vs. write strategy
- **Reads** (feed history, profiles, saved, timeline): client → Supabase directly, secured by
  **RLS** (`auth.uid()` → parent). Fast, cacheable, offline-friendly.
- **Orchestrated writes/logic** (tip selection, assistant, billing webhooks, SMS): go through
  the **Node API** where the ported selection algorithm and Claude/safety logic live. Keeps
  the IP server-side and lets the SMS leg and the app share one engine.

## 4. The content engine port (critical)
The tip-selection algorithm (§4 of [01-AUDIT.md](01-AUDIT.md)) is reimplemented in TypeScript
as a **pure, unit-tested module** (`packages/engine`) shared by:
- the Node API `/feed` endpoint (app), and
- the SMS cron worker (legacy leg).

Inputs: child (age/stage), candidate content rows, recent message history, parent prefs,
date. Output: selected tip + render payload. Same weights (`stageBoost 20`, `leapBoost 25`,
`novelty 15`, `cooldown 21d`, rotation/difficulty penalties). Porting it with tests is the
single most important Phase-1 task — it's the product's IP.

## 5. Scheduling / daily send
- `pg_cron` (or Railway cron) ticks (e.g., every 15 min); selects parents whose local
  preferred time has arrived and who haven't received today's card (timezone-aware day key —
  exactly the `wasDailyMessageSentToday` guard, now a SQL uniqueness constraint).
- Fan-out: push (Expo) + SMS (Twilio, opted-in) + write `messages` row (selection audit).
- Idempotency via a unique `(parent_id, child_id, send_date)` constraint on `messages`.

## 6. Environments & infra
- `dev` / `staging` / `prod` Supabase projects + Railway services.
- Secrets in Railway/Supabase env (never in DB — fixes audit R2).
- Twilio signature validation on the SMS webhook (fixes R1).
- Observability: Sentry (app + API), PostHog (product), Supabase logs, structured logs in the worker.

## 7. Security & privacy
- RLS on every table; parents only see their family. Caregiver access via a join table with roles.
- PII minimization for children (name + birthdate + optional gender/photo only).
- Encryption at rest (Supabase) + TLS in transit.
- GDPR/CCPA export + delete endpoints; consent + audit tables (port the opt-in provenance).
- Rate limiting + signature validation on public endpoints (reuse Highmark patterns).

## 8. Testing strategy
- **Engine**: exhaustive unit tests (selection determinism, cooldown, rotation, stage/leap boosts).
- **API**: integration tests against a test Supabase (feed, onboarding, assistant guardrails).
- **App**: component tests (RN Testing Library) + Maestro/Detox E2E for onboarding & daily loop.
- **AI safety**: a red-team eval set the safety classifier must pass before assistant launch.
