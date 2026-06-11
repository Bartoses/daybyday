# 01 — Existing System Audit (Reverse-Engineered)

Source of truth: the live Apps Script project (`clasp` id
`1AVk99mRplPdymLml3csTypjLFwZ9f4ab5lqEPmZD58YhehQXiLwxPJKW`), 22 `.gs` files, pulled and read
in full, plus the bound Google Sheet. This document is what the system **actually does** today.

> ⚠️ The short `Code.js` / `knowledge.js` / `daily.js` stubs are **dead code**. Apps Script
> loads all files into one global scope; the last definition of a duplicated function wins.
> The authoritative entry point is `WebApp.js` → `SmsFlow.js`, not `Code.js`.

---

## 1. System map

```
Twilio (inbound SMS webhook)
   │  POST  (ANYONE_ANONYMOUS web app)
   ▼
WebApp.js  doPost(e) ──► SmsFlow.js  handleIncomingSmsWebhook_
   │
   ├─ STOP/HELP/START keyword routing
   ├─ Onboarding FSM (handleOnboardingReply_)
   ├─ Interactive menu replies (1–6) ──► Guides/Messages content engine
   ├─ Pending-state handlers (checkin / milestone / milestone-date / share)
   └─ Free-text question ──► handleParentQuestion_ (keyword match or saved to queue)

Time-driven trigger ──► daily.js  sendDailyMessages()  (LockService global lock)
   └─ per active parent ──► content engine ──► sendSmsMessage ──► Twilio REST

Google Form ──► OptIn.js  (Forms-based acquisition channel, separate from SMS START)

Admin menu / Triggers.js ──► setup, manual sends, doc generation (Docs.js)

Storage: one Google Spreadsheet, 7 tabs, accessed via Sheets.js generic ORM.
Secrets: Script Properties OR the `Config` sheet tab (plaintext).
```

### Files by responsibility

| File | Lines | Responsibility |
|------|-------|----------------|
| `WebApp.js` | 44 | `doPost` HTTP entry; routes to SMS flow |
| `SmsFlow.js` | 707 | Inbound routing, onboarding FSM, reply handlers, question handling |
| `Config.js` | 420 | `APP_CONFIG`: schema, aliases, stages, scoring weights, milestone prompts, copy |
| `Sheets.js` | 253 | Generic Sheet ORM: header maps, alias normalization, CRUD, `__unused__` handling |
| `daily.js` | 295 | Daily send loop, child round-robin, category rotation, tip selection orchestration |
| `Guides.js` | 2134 | Tip selection scoring, family message assembly, SMS splitting/labeling |
| `knowledge.js` | 182 | Knowledge sheet read + normalization + question keyword match |
| `knowledge_generator.js` | 1130 | Bulk content generation into the Knowledge sheet |
| `Messages.js` | 267 | Delivery log writes, render helpers |
| `OptIn.js` | 561 | Google Forms opt-in ingestion + welcome SMS + consent provenance |
| `Parents.js` | 230 | Parent CRUD, preferences JSON read/write |
| `Kids.js` | 217 | Child CRUD, age calculation, renderable-children filter |
| `Milestones.js` | 26 | Milestone record CRUD + `hasMilestone` |
| `Questions.js` | 28 | Question queue CRUD |
| `Leap.js` | 88 | Wonder-Weeks-style developmental leap windows |
| `Docs.js` | 116 | Google Doc / PDF guide generation from a template |
| `Admin.js` | 636 | Admin spreadsheet menu, manual ops, diagnostics |
| `Triggers.js` | 26 | Time-driven trigger installation |
| `Twilio.js` | 78 | Twilio REST send wrapper |
| `Logging.js` | 64 | Structured logging helpers |
| `Utils.js` | 291 | Date/phone/string/hash utilities |
| `Code.js`, `daily.js`/`knowledge.js` stubs | — | **Dead / shadowed**; ignore |

---

## 2. Data model

Seven sheet "tables", read through `Sheets.js`. Header **aliases** (`Config.js
headerAliases`) let old column names map to canonical ones — evidence the schema has been
renamed in place at least once (`user_id`→`parent_id`, `kid_name`→`child_name`,
`birth_date`→`birthdate`). Columns prefixed `__unused__` are ignored by the ORM.

### `parents` (primary: **Parents**, alias **Users**)
| Field | Notes |
|-------|-------|
| `parent_id` | PK (alias of `user_id`) |
| `parent_phone`, `normalized_phone`, `phone` | E.164 normalized via `normalizePhone` |
| `parent_name` | |
| `status` | `ACTIVE` / `UNSUBSCRIBED` (delivery status) |
| `onboarding_step` | FSM state — see §3 |
| `last_checkin_topic`, `last_child_index` | round-robin + rotation state |
| `preferred_time`, `timezone` | send-time control (default `America/Denver`) |
| `sms_opt_in` (alias `opt_in`), `active` | consent + active flags |
| `preferences` | **JSON blob** — pending-state slots (`pending_checkin`, `pending_milestone`, `pending_milestone_date`, `pending_share`, `pending_child_name`, `onboarding_choice`, `last_daily_child_id`, `last_daily_topic`, `last_requested_category`, …) |
| `referral_code`, `referred_by` | referral graph (partly built) |
| opt-in provenance | `opt_in_source/method/form_url/response_sheet/timestamp`, `sms_consent_text`, `welcome_sms_sent_at`, `form_submission_timestamp` |
| `created_at`, `updated_at` | |

### `kids` (primary: **Children**, alias **Kids**)
| Field | Notes |
|-------|-------|
| `child_id` | PK |
| `parent_id` (alias `user_id`), `parent_phone` | FK to parent |
| `child_name` (alias `kid_name`/`name`) | |
| `birthdate` (alias `birth_date`/`date_of_birth`) | drives age-in-days |
| `due_date` | **pregnancy-aware** (pre-birth records possible) |
| `gender_optional`, `status`, `enrollment_source`, `opt_in_timestamp`, `notes`, `active` | |

### `knowledge` (primary: **Knowledge**)
The 190-column sheet. Code reads ~17 logical fields via **candidate-name fallback** so
multiple historical column names resolve to one concept:
| Logical field | Resolved from (first match wins) |
|---------------|----------------------------------|
| `child_age_days_min` | `child_age_days_min` / `age_min_days` / `min_age_days` |
| `child_age_days_max` | `child_age_days_max` / `age_max_days` / `max_age_days` |
| `category` | `category` / `topic` → `canonicalizeTopic_` |
| `insight_explanation` | `insight_explanation` / `insight` / `summary` |
| `action_tip` | `action_tip` / `action` / `tip` / `sms_tip` |
| `parent_reassurance` | `parent_reassurance` / `encouragement` / `reassurance` |
| `tip_id` | `tip_id` (else synthesized) |
| also | `child_age_stage`, `developmental_leap_phase`, `subcategory`, `development_focus`, `common_parent_misunderstanding`, `signs_of_healthy_development`, `when_to_consult_doctor`, `sms_tip`, `follow_up_prompt`, `youtube_resource_*`, `book_resource`, `research_reference`, `difficulty_level`, `rotation_group`, `priority_weight`, `cooldown_days`, `active`, `checkin_question`, `reply_options`, `milestone_key`, `keywords` |

This sheet is the **single most valuable asset** and the messiest. The migration must
collapse it into a clean typed table (see [07-DATABASE-DESIGN.md](07-DATABASE-DESIGN.md)).

### `messages` (primary: **Messages**, alias **DailyLog**)
Delivery log + selection audit: `message_id`, `parent_id`, `kid_id`, `topic`,
`message_type` (`daily`/`followup`/…), `tip_id`, rendered fields
(`insight_rendered`/`action_rendered`/`reassurance_rendered`), `category_family`,
`date_sent`, `message_text`, `send_status`, `twilio_sid_optional`, `error_optional`.
**This table is what powers cooldown + novelty + rotation** (recent history per kid).

### `milestones`, `questions`, `config`
- `milestones`: `parent_phone`, `child_id`, `milestone`, `date` — tracked achievements.
- `questions`: `question_id`, `parent_id`, `kid_id`, `question`, `status`
  (`new`/`answered`) — free-text question queue.
- `config`: key/value — **holds Twilio creds in plaintext** plus brand/timezone/send-hour.

---

## 3. Automation workflows

### Onboarding FSM (`SmsFlow.handleOnboardingReply_`)
```
NEW / (no row)
  └─ START or any text ─► create parent ─► WAITING_ONBOARDING_CHOICE
WAITING_ONBOARDING_CHOICE   (reply 1–3: daily guidance / sleep / big feelings)
  └─► WAITING_NAME
WAITING_NAME                (parent's name)
  └─► WAITING_CHILD_NAME
WAITING_CHILD_NAME          (child first name; stored in preferences.pending_child_name)
  └─► WAITING_CHILD_BIRTHDATE
WAITING_CHILD_BIRTHDATE     (MM/DD/YYYY ─► createKid)
  └─► ASK_ADD_CHILD
ASK_ADD_CHILD               (YES ─► WAITING_CHILD_NAME loop | NO ─► completeOnboarding_)
  └─► ONBOARDED
```
Post-onboarding, `handleUserReply` dispatches in priority order: pending milestone-date →
pending check-in → pending milestone → pending share → share keyword → numeric topic menu
→ `ADD CHILD` → free-text question.

### Daily send (`daily.sendDailyMessages`, time-driven trigger)
1. `LockService` global lock (serializes the whole run).
2. `getActiveParentsForDailySend()` — `status=ACTIVE && sms_opt_in && active_kid`.
3. Per parent: `wasDailyMessageSentToday` idempotency guard (timezone-aware day key).
4. **Child round-robin** (`selectNextChildForDaily_` advances `last_child_index`).
5. **Family category rotation** (`resolveFamilyRequestedCategory_`): deterministic hash of
   `parent_id + dateKey` over categories not used recently (`getRecentCategoriesForParent`).
6. Per child: `selectTipForChild` → `buildKidGuide` → `chooseKnowledgeRowForKid` (scored).
7. Render family message (greeting + opener + per-child section + menu + opt-out), split to
   SMS-length parts with `Part x/n` labels.
8. Send via Twilio REST; write a `messages` row per child (selection audit for future cooldown).

### Content scheduling extras (deterministic, hash-gated per parent/child/day)
- `shouldIncludeCheckin_` ~1/3 days, `shouldIncludeMilestone_` ~1/4, `shouldIncludeSharePrompt_` ~1/10.
- `getNextMilestonePrompt_` walks `APP_CONFIG.milestonePrompts` by age window, skipping
  milestones already recorded.

### Forms opt-in (`OptIn.js`)
Parallel acquisition path: a Google Form writes to an `Opt In` sheet; a trigger ingests new
rows, creates/updates the parent with full consent provenance, sends a TCPA-compliant welcome
SMS (12-hour cooldown), and marks the row processed. This is a **real second funnel** the new
platform must preserve (web signup → same consent capture).

---

## 4. Content engine (the crown jewel)

This is the part worth protecting. It is **not** a simple age-range lookup.

### Stages (`APP_CONFIG.stages`, age in days)
`newborn` 0–56 · `early_baby` 57–120 · `growing_baby` 121–210 · `exploring_baby` 211–365 ·
`new_toddler` 366–540 · `curious_toddler` 541–1095 · `preschooler` 1096–1825 ·
`early_school_age` 1826–3650.

### Categories
Canonical families: `sleep`, `feeding`, `development`, `learning/play`,
`emotional development`, `behavior`, `safety` (+ a wider rotating set canonicalized down).
`canonicalizeTopic_` maps ~20 raw labels onto these.

### Weighted tip selection (`chooseKnowledgeRowForKid` + `APP_CONFIG.knowledge`)
Candidate knowledge rows for the child's age are scored with:
- **stageBoostWeight 20** — matches child's stage
- **leapBoostWeight 25** — matches a current developmental leap phase (`Leap.js`)
- **noveltyWeight 15** — not seen recently
- **cooldown** (`defaultCooldownDays 21`, per-row override) — suppress recently-sent tips
- **categoryRotationPenalty 18** / **rotationGroupPenalty 12** — avoid repeating category/group
- **difficultyPenalty** easy 0 / medium 4 / hard 8
- `recentTipLookbackDays 45`, `nearbyAgeWindowDays 21`, `tipVariantsPerTopic 3`

Recent history comes from the `messages` log per child. Fallback synthesizes a `tip_id` and
blanks content when no clean match exists (so a parent never gets a duplicate).

### Rendering (`Guides.js` + `Messages.js`)
Per-child section = **insight → action ("try today") → encouragement**, with caps
(`maxInsightLength 120`, `maxActionLength 90`). Family message wraps greeting + opener +
sections + numeric menu + opt-out, then splits at sentence boundaries into ≤1200-char parts
with `Part x/n` headers. Siblings render in one message with shared footer.

### Inbound question handling
`findKnowledgeByQuestion` = **keyword `indexOf` match** (words ≥4 chars) against the
age-scoped rows' text. No embeddings, no LLM. Misses are saved to the `questions` queue with
a "no matching answer yet" reply. **This is the gap Phase 3's RAG assistant fills.**

---

## 5. Content generation (`knowledge_generator.js`)
A 1,130-line generator that bulk-produces knowledge rows across ages/categories into the
sheet. It is the source of the current 0–2190-day library. In the new platform this becomes
an **offline content-authoring pipeline** (LLM-assisted drafting + human review) feeding the
`content_items` table — not runtime code.

---

## 6. Risk register

| # | Risk | Severity | Detail | Resolution (new platform) |
|---|------|----------|--------|---------------------------|
| R1 | Open webhook | High | `doPost` is `ANYONE_ANONYMOUS`; no Twilio signature check — anyone can forge inbound SMS | Validate `X-Twilio-Signature` on the SMS leg; app traffic uses authenticated API |
| R2 | Plaintext secrets | High | Twilio SID/token live in the `Config` sheet | Move to env / secret manager; never in DB |
| R3 | Sheets-as-DB | High (scale) | Full-range scans + single global `LockService` lock per daily run; no indexes; race-prone concurrent writes | Postgres (Supabase) with indexes + row-level concurrency |
| R4 | Dead/shadowed code | Medium | Duplicate `doPost`/`getAgeDays`/`sendSms` across files; silent shadowing | Single typed codebase, no globals |
| R5 | 190-column knowledge sheet | Medium | Duplicate/aliased headers, `__unused__` sprawl, hand-edited | Clean typed `content_items` table + admin authoring UI |
| R6 | No real AI | Medium | "Assistant" = keyword `indexOf`; unanswered questions pile up in a queue | Phase-3 Claude RAG with safety layer |
| R7 | No analytics | Medium | Engagement only inferable from the `messages` log; no funnel/retention metrics | First-class analytics (PostHog/Amplitude) + event model |
| R8 | Content coverage | Medium | Only to ~2190 days, uneven density, single timezone default | Expand to school-age + pregnancy; per-user timezone (already modeled) |
| R9 | TCPA surface | Medium-legal | Consent provenance is captured but lives in a spreadsheet; STOP handling is keyword-based only | Preserve consent capture in DB with audit trail; keep SMS STOP/HELP/START compliant |
| R10 | No tests | Medium | No automated test suite around selection logic | Port selection logic with unit tests as the spec (see TDD) |
| R11 | Single point of failure | Low-Medium | Entire system depends on one Google account / Sheet / quota | Managed Postgres + horizontally-scalable backend |

---

## 7. What to preserve vs. replace

**Preserve (port faithfully):**
- The 8-stage model and age-in-days math (incl. pregnancy via `due_date`).
- The full tip-selection algorithm (weights, cooldown, rotation, novelty, leap boost) — this
  is the product's IP. The TDD reproduces it as a tested pure function.
- The knowledge **content** (every row), the milestone prompts, the category taxonomy.
- TCPA consent capture + STOP/HELP/START semantics on the SMS leg.
- The interactive reply menu metaphor (translates to feed/quick-actions in-app).

**Replace:**
- Sheets storage → Postgres. Apps Script runtime → Expo app + Node/Supabase backend.
- Keyword question matching → Claude RAG assistant (Phase 3).
- Hand-edited 190-col sheet → typed `content_items` + authoring pipeline.
- Plaintext creds + open webhook → secrets manager + signature validation.

**Decommission trigger (for the parallel SMS run):** once (a) the app's daily feed +
notification path is live and (b) all SMS-only subscribers have an app account (n=0 today, so
this is trivial), point the Twilio number at the new backend's SMS leg and retire the Apps
Script project. Until then it runs untouched.
