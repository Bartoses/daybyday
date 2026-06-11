# 02 — Product Requirements Document

## 1. Vision

> **DaybyDay is the parenting companion that grows with families, one day at a time.**

Every parent wakes up to a calm, trustworthy, age-perfect piece of guidance for *their*
child — and can go deeper the moment a question, a hard night, or a milestone arrives.
DaybyDay turns the overwhelming, fragmented experience of modern parenting into a single,
gentle daily rhythm backed by evidence and personalized to each child.

### Principles (every feature is measured against these)
1. **Personalized** — content keys off each child's exact age (in days), stage, and history.
2. **Trustworthy** — evidence-based, sourced, with explicit "when to call your doctor" safety rails.
3. **Calm** — never alarmist, never a doom-scroll; one meaningful thing at a time.
4. **Evidence-based** — grounded in developmental science; citations available.
5. **Age-aware** — pregnancy → school age, automatically advancing each day.
6. **AI-assisted** — an assistant that *knows the child*, not a generic chatbot.
7. **Family-centered** — multiple children, multiple caregivers, one shared context.

### Non-goals (explicitly out of scope)
- Not a medical/diagnostic tool. Not a social network/feed of other parents.
- Not a telehealth provider. Not a marketplace. Not ad-supported.

---

## 2. Target users & jobs-to-be-done

| Persona | Situation | Primary JTBD |
|---------|-----------|--------------|
| **New parent (0–12 mo)** | Sleep-deprived, anxious, googling at 3am | "Tell me what's normal and what to do tonight." |
| **Toddler parent (1–3 yr)** | Big feelings, behavior, picky eating | "Help me handle this moment without losing it." |
| **Preschool/school-age parent** | Development, learning, independence | "Keep me a step ahead of what's coming." |
| **Expecting parent** | Pregnancy, preparing | "Get me ready, week by week." |
| **Second caregiver** (partner, grandparent, nanny) | Shares the child, not the account | "Stay in sync on the same guidance." |

---

## 3. Feature set

### 3.1 Daily Parenting Feed (core loop)
The home surface. One personalized **Today** card per child, plus an expandable feed.
- Daily guidance (insight → try-today action → encouragement) — *ported engine*
- Daily activity suggestion (play/learning, age-appropriate)
- Contextual modules surfaced by age/history: sleep guidance, feeding guidance,
  development notes, milestone check-ins
- Quick actions mirroring the SMS menu: *Another tip · Sleep · Play · Feeding · Behavior · Ask*
- "Mark helpful / not helpful" feedback (feeds personalization + content quality)

**Acceptance:** every onboarded child shows a fresh, non-repeating (cooldown-respecting) card
each day; tapping a quick action returns an in-category tip in <1s from cache.

### 3.2 Child Profiles
- **Unlimited children**, each with name, birthdate (or due date for pregnancy), optional gender, photo
- Per-child **stage** badge and live **age in days / weeks / months**
- **Development tracking**: milestones (achieved/upcoming), growth notes
- **Multiple caregivers** per child (invite by email/phone; roles: owner, caregiver, viewer)
- Switch active child; family view for siblings

**Acceptance:** adding a child immediately produces an age-correct feed; a milestone marked
"achieved" stops its prompt and appears on the timeline.

### 3.3 Developmental Timeline
A continuous, scrollable life map per child:
`Pregnancy → Newborn → Infant → Toddler → Preschool → School Age`, anchored on the 8-stage
model. Shows: where the child is now, milestones (done/upcoming with typical ranges), and
"what's next." Doubles as a keepsake (achieved milestones with dates/notes/photos).

**Acceptance:** timeline renders the correct current stage from birthdate; upcoming-milestone
windows match `milestonePrompts` ranges; achieved milestones persist with date + optional note.

### 3.4 AI Parenting Assistant *(Phase 3)*
A chat that **knows the child**. Must have access to: child age + stage, recent guidance
history, parent preferences, prior conversation, and the curated knowledge base. Must produce:
contextual, evidence-based, **safe** answers with citations and clear escalation ("this needs
a pediatrician") rails. See [06-AI-ARCHITECTURE.md](06-AI-ARCHITECTURE.md).

**Acceptance:** assistant answers reference the specific child by name/age; safety classifier
intercepts red-flag inputs (e.g., fever in a newborn, breathing concerns) with a "seek care now"
response; every answer is grounded in retrieved content (no free-floating medical claims).

### 3.5 Notifications (multi-channel)
- **Push** (primary, in-app) — daily card ready, milestone nudges, check-ins
- **SMS** — the legacy channel; in the new world a *fallback / re-engagement* leg + the
  bridge for users who prefer text. TCPA-compliant (consent, STOP/HELP/START preserved).
- **Email** — weekly digest, account, receipts
- **In-app** — inbox of past guidance, replies, milestone reminders

User controls quiet hours, per-channel toggles, and per-child notification preferences.

### 3.6 Saved Content
Bookmarks, favorites, **personal notes** on any tip, and **collections** (e.g., "Sleep ideas
that worked", "Questions for the 1-yr visit"). Searchable. Exportable to PDF (preserves the
`Docs.js` keepsake idea).

### 3.7 Sharing & referral
Invite a co-parent (full caregiver) or share a tip / refer a friend (the existing
`pending_share` flow, generalized). Referral codes already modeled on the parent record.

### 3.8 Account, settings, privacy
Profile, caregivers, notification prefs, timezone, plan/billing, data export & delete
(GDPR/CCPA), consent history.

---

## 4. Monetization

Curated-first means the **free tier is genuinely useful** (daily feed) and paid tiers unlock
depth, the AI assistant, and family features.

### Plans
| Plan | Price (target) | Includes |
|------|----------------|----------|
| **Free** | $0 | One child · daily feed · basic timeline · milestone tracking · SMS or push (one channel) |
| **Premium** | $8.99/mo or **$59.99/yr** | Unlimited tips/quick-actions · full timeline + keepsake export · saved content & collections · all notification channels · **AI assistant (Phase 3)** · ad-free forever |
| **Family** | $14.99/mo or **$99.99/yr** | Everything in Premium · unlimited children · **multiple caregivers** · shared family context · priority assistant |
| **Annual** | (the yr prices above) | ~2 months free vs monthly; primary conversion target |

> Pricing is a starting hypothesis to validate; see metrics below. Pregnancy→school-age
> lifespan gives unusually long LTV potential (years of daily engagement).

### Conversion architecture
- **Upgrade triggers** (contextual, never nagging):
  - Tap a 2nd quick-action in a day → "Premium unlocks unlimited tips."
  - Add a 2nd child → Family plan prompt.
  - Invite a caregiver → Family plan.
  - First AI-assistant question → Premium paywall (Phase 3).
  - Export keepsake / timeline PDF → Premium.
- **Free→paid loops:** weekly digest highlighting locked depth; milestone moments
  (high emotion) as gentle upgrade points; annual discount surfaced at month 1 of monthly.
- **Retention systems:** daily streak (calm, non-punitive), milestone celebrations,
  "what's next" anticipation, weekly recap email.

### Revenue projection (illustrative model, to validate)
Assumptions: organic + referral acquisition; parenting apps typically see 2–5% free→paid.
| Stage | Installs | Active free | Paid % | Paid users | ARPU/yr | ARR |
|-------|----------|-------------|--------|-----------|---------|-----|
| Launch (Phase 1–2) | 5,000 | 2,500 | 3% | 75 | $70 | ~$5K |
| Growth (Phase 3) | 50,000 | 22,000 | 4% | 880 | $75 | ~$66K |
| Scale (Phase 4) | 300,000 | 120,000 | 5% | 6,000 | $80 | ~$480K |

These are planning placeholders — instrument from day one and replace with real cohort data.

---

## 5. Success metrics (north stars per phase)

| Phase | North star | Guardrails |
|-------|-----------|------------|
| 1 (Migration MVP) | % of signups that complete onboarding & receive first daily card | Crash-free sessions >99.5%; daily send reliability >99% |
| 2 (Core platform) | **D7 / D30 retention** of daily-feed users | Notification opt-in rate; tips-marked-helpful rate |
| 3 (AI companion) | Assistant questions/active user/week; free→Premium conversion | Safety-intercept precision/recall; grounded-answer rate (no hallucinated medical claims) |
| 4 (Scale) | MRR / ARR; LTV:CAC | Churn <5%/mo; infra cost per active user |

---

## 6. Constraints & compliance
- **TCPA** — preserve documented consent + STOP/HELP/START on any SMS.
- **COPPA-adjacent** — the *child* is a data subject but not the user; minimize child PII,
  parent is account holder & consent authority. No child accounts.
- **Medical safety** — clear "not medical advice" framing; hard safety rails in the assistant;
  curated content carries "when to consult a doctor" fields (already in the schema).
- **Privacy** — GDPR/CCPA: export + delete; data minimization; encryption at rest/in transit.
- **App Store / Play** — health-adjacent content review readiness; no medical claims without sourcing.
