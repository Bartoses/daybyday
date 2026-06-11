# 09 — Roadmap

Four phases. Curated-first: real value ships before AI. SMS runs in parallel throughout and is
sunset only after app parity (trivial today — zero users). Effort in engineer-weeks (EW),
assuming ~2 engineers + part-time design; treat as relative sizing, not commitments.

---

## Phase 1 — Migration MVP (foundation)
**Goal:** a real, installable app that delivers the proven daily-guidance experience from a
clean backend, plus the legacy SMS leg intact.

**Features**
- Auth + onboarding (FSM parity), child profiles (incl. pregnancy via due date)
- **Daily feed** powered by the **ported selection engine**
- Quick actions (another/sleep/play/feeding/behavior)
- Push notifications (daily card) + SMS leg retained (signature-validated)
- Basic timeline (stage + age), milestone tracking
- Content migration: Knowledge sheet → typed `content_items`

**Technical requirements**
- Supabase schema + RLS ([07](07-DATABASE-DESIGN.md)); `content_items` importer
- `packages/engine` — TS port of the scoring algorithm **with unit tests** (the keystone task)
- Node API: `/account`, `/children`, `/feed/*`, `/webhooks/sms`, daily-send cron
- Expo app shell: Today, Timeline (basic), Profile; onboarding flow
- Secrets to env; Twilio signature validation

**Dependencies:** Supabase + Railway projects; Twilio number; Apple/Google dev accounts; design tokens.
**Effort:** ~10–14 EW. **Risks:** engine-port fidelity (mitigate with parity tests vs. old
output); content-import data quality (verify counts + spot-checks).
**Success metrics:** onboarding completion %, first-card delivery reliability >99%, crash-free >99.5%.

---

## Phase 2 — Core Parenting Platform
**Goal:** the daily-habit product worth retaining and paying for (still no LLM).

**Features**
- Full **Timeline** + keepsake PDF export
- **Saved content, collections, notes**
- Multi-caregiver (Family plan) + invites
- Notification depth: quiet hours, per-child, preferred time, milestone/check-in nudges
- Email weekly digest
- **Billing**: Free/Premium/Family/Annual (RevenueCat + Stripe), contextual paywalls
- Content expansion (fill 0–2190+ days; extend toward school age & pregnancy)
- Analytics instrumentation (PostHog funnels + retention)

**Technical requirements:** collections/saved/subscriptions/notification_prefs tables;
RevenueCat/Stripe webhooks; email service; export service; caregiver RLS; analytics events.
**Dependencies:** Phase 1; payment provider approval; content authoring capacity.
**Effort:** ~12–16 EW. **Risks:** subscription/entitlement edge cases; content throughput
(staff/contract an author); notification fatigue (cap + quiet hours).
**Success metrics:** **D7/D30 retention**, push opt-in rate, free→paid %, tips-helpful rate.

---

## Phase 3 — AI Parenting Companion
**Goal:** the child-aware assistant + AI-augmented recommendations — the differentiation.

**Features**
- AI Assistant (chat) — grounded RAG, child-aware, cited
- Safety layer (pre/post classifiers, escalation) — **launch gate**
- Family memory (durable, editable)
- AI-augmented daily recommendations (rerank by helpful signals + memory)
- Suggested questions; assistant inbox replaces the passive question queue

**Technical requirements:** pgvector + embeddings pipeline; `assistant_*` + `family_memory`
tables; retrieval + rerank service; Claude integration (opus/haiku) with prompt caching;
red-team eval harness; Premium gating + cost controls.
**Dependencies:** Phase 2 (billing for gating); reviewed/sourced content; safety eval set.
**Effort:** ~14–18 EW. **Risks:** safety (highest — do not launch until eval thresholds met);
groundedness/hallucination; latency; cost per user (gate + cache).
**Success metrics:** assistant Qs/active user/week, groundedness %, safety precision/recall,
free→Premium lift, retention lift among assistant users.

---

## Phase 4 — Scale & Growth
**Goal:** efficient growth, broadened content, operational maturity.

**Features**
- Referral/sharing engine (generalize the existing share flow)
- Localization / i18n (content already has language/region fields)
- Partner/clinic distribution; web SEO content surfaces
- Advanced personalization & experimentation (A/B framework — fields exist: `ab_test_group`)
- Pregnancy track depth; expanded school-age content; possibly expert Q&A/community (guarded)
- Admin/content CMS maturity; cost & reliability hardening

**Technical requirements:** experimentation platform; i18n pipeline; CDN/SEO web; scaled infra
(read replicas, caching); content CMS; observability/SLOs.
**Dependencies:** Phases 1–3; growth budget; content localization.
**Effort:** ongoing. **Risks:** CAC/LTV economics; content quality at scale; infra cost.
**Success metrics:** **MRR/ARR, LTV:CAC**, churn <5%/mo, infra cost/active user, organic share.

---

## Cross-cutting / always-on
- **SMS parallel run** every phase; sunset trigger = app daily-send live + all SMS users have
  app accounts (n=0 now). Decommission Apps Script then.
- TCPA/privacy compliance maintained continuously (consent + STOP/HELP/START).
- Test coverage gates (engine unit tests, API integration, safety evals) block release.

## Timeline sketch (2 eng + design)
```
Q1: Phase 1 ───────────────►
Q2:        Phase 2 ─────────────────►
Q3:                    Phase 3 ──────────────►
Q4+:                              Phase 4 (ongoing)
```
