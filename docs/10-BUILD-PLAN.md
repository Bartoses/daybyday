# 10 — Claude Code Execution Plan

Hierarchy: **Epic → Feature → User Story → Tasks (with Acceptance Criteria)**. Phase 1 is
specified to task level for immediate execution; Phases 2–4 are specified to story level.
Every task is scoped to be independently executable by Claude Code.

**Repo shape (monorepo, pnpm + Turborepo):**
```
daybyday/
├── apps/
│   ├── mobile/        # Expo (RN) app — iOS, Android, Web
│   └── api/           # Node + Fastify
├── packages/
│   ├── engine/        # ported tip-selection algorithm (pure, tested)
│   ├── schemas/       # shared Zod types (API ⇄ app)
│   └── db/            # Supabase migrations + generated types
├── workers/
│   └── cron/          # daily send, notifications, digest
├── tools/
│   └── import/        # Sheets → Postgres content importer
└── docs/              # this folder
```
Legacy `*.gs` files stay at repo root untouched until SMS sunset.

---

# PHASE 1 — Migration MVP

## EPIC 1: Platform foundation & infra
### Feature 1.1 — Monorepo & tooling
- **Story:** As a developer, I have a typed monorepo so app, API, engine, and schemas share types.
  - **T1.1.1** Init pnpm + Turborepo monorepo with the structure above. *AC:* `pnpm install` +
    `pnpm build` succeed; Turbo pipelines for lint/test/build defined.
  - **T1.1.2** Add `packages/schemas` (Zod) and `packages/db` (Supabase types) wired into app + api.
    *AC:* a shared type imported in both `apps/api` and `apps/mobile` compiles.
  - **T1.1.3** ESLint + Prettier + tsconfig base; GitHub Actions CI (lint, typecheck, test). *AC:* CI green on PR.

### Feature 1.2 — Supabase project & schema
- **Story:** As the platform, I persist families and content in Postgres with RLS.
  - **T1.2.1** Create Supabase migrations for all Phase-1 tables ([07](07-DATABASE-DESIGN.md)):
    `parents, children, caregivers, content_items, messages, milestones, questions,
    notification_prefs, consents, push_tokens, subscriptions`. *AC:* `supabase db push` applies
    cleanly; generated TS types in `packages/db`.
  - **T1.2.2** Enable RLS + policies (parent-scoped + active-caregiver). *AC:* a parent cannot
    read another parent's children (integration test); `content_items` world-readable when `active`.
  - **T1.2.3** Seed enums/reference data (stages, categories, milestone prompts from `APP_CONFIG`).
    *AC:* stage day-ranges match `Config.js` exactly.

### Feature 1.3 — Secrets & security baseline
  - **T1.3.1** Move all secrets to env (no creds in DB). *AC:* no secret string in any migration/seed.
  - **T1.3.2** Twilio signature validation middleware on `/webhooks/sms`. *AC:* unsigned request → 403;
    valid signature passes (unit-tested, pure verifier).

## EPIC 2: Content migration (the keystone)
### Feature 2.1 — Knowledge sheet → `content_items`
- **Story:** As the platform, I import every existing tip into a clean typed table without loss.
  - **T2.1.1** Build `tools/import` reader that pulls the Knowledge sheet (CSV export or Sheets API).
    *AC:* reads all rows; ignores `__unused__*`.
  - **T2.1.2** Port `normalizeKnowledgeRow_` candidate-name fallback + `canonicalizeTopic_` to TS.
    *AC:* unit tests cover each alias path (e.g., `summary`→`insight`, `tip`→`action_tip`,
    `min_age_days`→`age_min_days`); category canonicalization matches `knowledge.js` table.
  - **T2.1.3** Dedupe by `tip_id` (synthesize stable id when missing, same scheme as `buildFallbackTipId_`)
    and upsert into `content_items`. *AC:* row-count parity report (sheet logical rows vs inserted);
    no duplicate `tip_id`.
  - **T2.1.4** Parity spot-check harness: render 20 random tips via the new engine and compare to
    expected fields. *AC:* fields match the sheet content for all 20.

## EPIC 3: Tip-selection engine port (the IP)
### Feature 3.1 — `packages/engine`
- **Story:** As the platform, the daily-card algorithm behaves identically to the proven system.
  - **T3.1.1** Port stage resolution + age-in-days (incl. `due_date` pregnancy handling). *AC:* unit
    tests over stage boundaries (0/56/57/120/...) match `APP_CONFIG.stages`.
  - **T3.1.2** Port candidate filtering (age-window, active) + scoring: stageBoost 20, leapBoost 25,
    novelty 15, cooldown (21d default + per-row override), categoryRotationPenalty 18,
    rotationGroupPenalty 12, difficultyPenalty easy/med/hard 0/4/8. *AC:* deterministic given fixed
    inputs; unit tests assert the chosen tip for crafted candidate sets.
  - **T3.1.3** Port family category rotation (`resolveFamilyRequestedCategory_`, deterministic hash)
    + child round-robin. *AC:* same parent/date yields same category; recently-used categories excluded.
  - **T3.1.4** Port cooldown/novelty using `messages` recent-history (lookback 45d). *AC:* a tip sent
    within cooldown is not reselected; falls back without duplicating.
  - **T3.1.5** Port render payload (insight→action→encouragement, caps 120/90) + SMS length splitting
    (≤1200, `Part x/n`). *AC:* multi-child families render in spec; long messages split at sentence boundaries.

## EPIC 4: Backend API
### Feature 4.1 — Account & onboarding
  - **T4.1.1** Fastify app + Supabase JWT verification middleware → resolves `parent`. *AC:* missing
    token → 401; valid token resolves parent.
  - **T4.1.2** `POST /account/bootstrap`, `GET /me`. *AC:* creates parent + writes a `consents` row;
    `/me` returns parent + children + subscription.
  - **T4.1.3** `POST/PATCH/DELETE /children`; `POST /onboarding/complete` (sets `ONBOARDED`, triggers
    first card). *AC:* adding a child returns correct `age_days`+`stage`; complete → first feed card exists.
### Feature 4.2 — Feed
  - **T4.2.1** `GET /feed/today?child_id` (engine-backed, idempotent per day). *AC:* same day → same
    card; logs a `messages` row once (unique constraint enforced).
  - **T4.2.2** `POST /feed/quick-action` (another/sleep/play/feeding/behavior). *AC:* returns in-category
    tip respecting cooldown/rotation; free-tier 2nd/day → 402 paywall payload.
  - **T4.2.3** `POST /feed/:tip_id/feedback`. *AC:* stores helpful/not-helpful signal.

## EPIC 5: SMS leg parity
### Feature 5.1 — Twilio webhook on the new engine
  - **T5.1.1** `POST /webhooks/sms` routing STOP/HELP/START (port `isOptOutMessage_` set + copy). *AC:*
    STOP → unsubscribe + confirmation; HELP/START per `SmsFlow.js`.
  - **T5.1.2** Port onboarding FSM + menu (1–6) + pending handlers to the API, sharing `packages/engine`.
    *AC:* full SMS onboarding completes; numeric menu returns category tips identical to app.
  - **T5.1.3** Twilio REST send wrapper + delivery logging to `messages`. *AC:* sends recorded with sid/status.

## EPIC 6: Daily-send worker
  - **T6.1.1** Cron worker (`workers/cron`) tick selecting due parents (local preferred time, not sent
    today). *AC:* timezone-correct day key; no double-send (unique constraint).
  - **T6.1.2** Fan-out: push (Expo) + opted-in SMS; write `messages`. *AC:* opted-in parent gets both
    channels; opted-out gets push only.

## EPIC 7: Mobile app (Expo) — MVP
### Feature 7.1 — Shell, auth, onboarding
  - **T7.1.1** Expo + Expo Router + design tokens ([04](04-DESIGN-SYSTEM.md)); 5-tab nav. *AC:* runs on
    iOS, Android, web from one build.
  - **T7.1.2** Supabase Auth (email/Apple/Google) + onboarding flow (name→child→birthdate→add-another→
    focus→push perm). *AC:* completes to a populated Today card in <3 min path; consent captured.
### Feature 7.2 — Today + Timeline + Profile
  - **T7.2.1** Today screen: DailyCard + QuickActionBar + ChildSwitcher; consume `/feed/*`. *AC:* fresh
    non-repeating card daily; quick actions <1s from cache; helpful/save work.
  - **T7.2.2** Basic Timeline (stage + age + milestones) consuming `/children/:id/timeline`. *AC:*
    correct stage from birthdate; upcoming-milestone windows match config.
  - **T7.2.3** Profile/children CRUD + notification prefs. *AC:* add/edit/delete child; toggle channels.
  - **T7.2.4** Push registration (`/push/register`) + daily push handling. *AC:* token stored; tapping
    push deep-links to Today.

## EPIC 8: Observability & release
  - **T8.1.1** Sentry (app+api) + PostHog events (onboarding funnel, daily-card view, quick-action). *AC:* events visible.
  - **T8.1.2** EAS Build + store submission config; staging + prod envs. *AC:* TestFlight/internal build installs.

**Phase 1 Definition of Done:** new user signs up → onboards → receives a correct, engine-selected
daily card on push + in-app (and SMS if opted in) → views timeline → all behind RLS, secrets in env,
Twilio webhook signed, content imported with parity, engine unit-tested.

---

# PHASE 2 — Core Platform (story level)

## EPIC 9: Saved content & collections
- Story: bookmark/favorite a tip → **T:** `saved_items` API + UI; *AC:* persists, appears in Saved.
- Story: create collections + notes → **T:** `collections`/`collection_items`/note API + UI.
## EPIC 10: Full timeline + keepsake export
- Story: scrollable life map + milestone keepsake → **T:** timeline detail UI; `GET /export/keepsake` PDF (Premium).
## EPIC 11: Multi-caregiver (Family)
- Story: invite co-parent with role → **T:** `caregivers` invite/accept flow + caregiver RLS; *AC:* both see shared child.
## EPIC 12: Notifications depth
- Story: quiet hours, per-child, preferred time, milestone/check-in nudges → **T:** prefs API+UI; worker honors quiet hours.
## EPIC 13: Billing
- Story: subscribe to Premium/Family/Annual → **T:** RevenueCat (mobile) + Stripe (web); `subscriptions`
  table; webhooks; entitlement checks; contextual paywalls; *AC:* gating enforced server-side.
## EPIC 14: Content expansion
- Story: fill 0–2190+ days, extend school-age + pregnancy → **T:** authoring pipeline + review; *AC:* coverage report.
## EPIC 15: Email digest + analytics
- Story: weekly recap email → **T:** Resend digest job. Story: retention dashboards → **T:** PostHog funnels/cohorts.

---

# PHASE 3 — AI Companion (story level)

## EPIC 16: Knowledge embeddings
- Story: embed content for retrieval → **T:** `content_embeddings` + ivfflat; embedding job on publish.
## EPIC 17: RAG retrieval service
- Story: age-gated hybrid retrieval → **T:** vector+structured+keyword search; rerank; *AC:* newborn query never returns toddler content.
## EPIC 18: Safety layer (launch gate)
- Story: red-flag interception → **T:** pre-classifier (bypass→seek-care) + post-validator (block diagnosis/dosing);
  red-team eval set; *AC:* meets precision/recall thresholds before assistant ships.
## EPIC 19: Assistant chat
- Story: child-aware grounded chat → **T:** `assistant_threads/messages`, `POST /assistant/messages` (SSE),
  Claude opus/haiku + prompt cache, citations, Premium gate; *AC:* answers cite content + reference child by age.
## EPIC 20: Family memory
- Story: durable editable memory → **T:** `family_memory` CRUD + injection into context; *AC:* parent can view/edit/delete.
## EPIC 21: AI-augmented recommendations
- Story: rerank daily picks by helpful signals + memory → **T:** recommender bounded by engine safety/cooldown.

---

# PHASE 4 — Scale & Growth (story level)
## EPIC 22: Referral/sharing engine (generalize existing share flow + referral codes).
## EPIC 23: i18n/localization (content language/region fields already present).
## EPIC 24: Experimentation (A/B; `ab_test_group` field exists).
## EPIC 25: Web SEO surfaces + partner/clinic distribution.
## EPIC 26: Content CMS maturity + admin tooling.
## EPIC 27: Infra hardening (read replicas, caching, SLOs, cost/user).

---

## Suggested execution order for Claude Code (Phase 1)
1. EPIC 1 (monorepo) → EPIC 1.2 (schema) — unblock everything.
2. EPIC 3 (engine) **in parallel with** EPIC 2 (content import) — both feed the feed.
3. EPIC 4 (API feed/account) → EPIC 7 (app) — vertical slice to a visible daily card.
4. EPIC 6 (cron) + EPIC 5 (SMS parity) — delivery + legacy leg.
5. EPIC 8 (observability/release).

Each task ships with tests; the engine and content-import parity tests are the
non-negotiable gates (they protect the migrated IP).
