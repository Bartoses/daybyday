# 03 — Information Architecture

## 1. Sitemap

```
DaybyDay App
│
├── Onboarding (unauthenticated → authenticated)
│   ├── Welcome / value prop
│   ├── Sign up (email + password / Apple / Google)  ──┐
│   ├── Consent (SMS opt-in capture, TCPA copy)         │ preserves OptIn.js provenance
│   ├── Parent name
│   ├── Add child (name → birthdate/due date → gender?) │ mirrors onboarding FSM
│   ├── Add another child? (loop)
│   ├── Focus areas (daily guidance / sleep / big feelings)  ← onboarding choice
│   └── Notification permission (push) + quiet hours
│
├── Home  ▸ "Today"           [TAB 1]
│   ├── Per-child Today card (insight · try-today · encouragement)
│   ├── Quick actions: Another · Sleep · Play · Feeding · Behavior · Ask
│   ├── Daily activity suggestion
│   ├── Check-in / milestone prompt (contextual)
│   ├── Child switcher (if >1) + Family view
│   └── Feed (scroll: today + recent days)
│
├── Timeline                  [TAB 2]
│   ├── Stage map (Pregnancy → School Age)
│   ├── Current stage detail
│   ├── Milestones (achieved / upcoming, typical ranges)
│   └── Keepsake export (PDF)
│
├── Assistant  ▸ "Ask"        [TAB 3]   (Phase 3; Phase 1–2 = saved-question inbox)
│   ├── Chat (child-aware)
│   ├── Suggested questions (age-based)
│   ├── Safety escalation surfaces
│   └── Citations / sources drawer
│
├── Saved                     [TAB 4]
│   ├── Bookmarks / favorites
│   ├── Collections
│   └── Notes
│
└── Profile / Settings        [TAB 5]
    ├── Children (CRUD, photos, caregivers)
    ├── Caregivers & invites (roles)
    ├── Notifications (channels, quiet hours, per-child)
    ├── Plan & billing (Free / Premium / Family / Annual)
    ├── Account (email, password, timezone)
    └── Privacy (export, delete, consent history)
```

## 2. Navigation
- **Primary:** 5-tab bottom bar (mobile) / left rail (web): **Today · Timeline · Ask · Saved · Profile.**
- **Today** is home and the daily habit anchor.
- **Child context** is global: a persistent child switcher in the Today header; the active
  child scopes Today, Timeline, and Ask.
- Web uses the identical IA (Expo Router → same routes) with responsive layout.

## 3. Core user journeys

### J1 — First run → first value (target <3 min)
Welcome → sign up → consent → name → add child (birthdate) → focus area → push permission →
**Today card appears immediately** (don't wait for tomorrow's send). Success = first card seen.

### J2 — Daily habit loop
Push at preferred time → open Today card → read insight → tap "try today" → optionally tap a
quick action → mark helpful. Reinforced by streak + tomorrow's anticipation.

### J3 — Hard-moment loop (retention driver)
Trigger (bad night, tantrum) → open app → tap Sleep/Behavior quick action **or** Ask the
assistant → get an immediate, child-specific, calm answer → save it to a collection.

### J4 — Milestone moment (emotional + viral)
Milestone prompt ("Has Maya rolled over?") → "Yes" → capture date/photo → celebration →
timeline updates → optional share/refer. High-emotion upgrade point.

### J5 — Family expansion (monetization)
Add 2nd child or invite co-parent → Family-plan prompt → both caregivers see shared context.

### J6 — SMS bridge (legacy parity)
Existing/preferred-text users keep the SMS daily card; an in-message link deep-links into the
app. New signups can choose SMS, push, or both. Consent + STOP/HELP/START preserved.

## 4. Engagement & retention systems
| System | Mechanic | Serves |
|--------|----------|--------|
| Daily card | One fresh, non-repeating tip/child/day (cooldown-respecting) | Habit (J2) |
| Streak | Calm, non-punitive consecutive-day counter | Habit |
| Smart notifications | Per-user preferred time + quiet hours; contextual check-ins | Re-engagement |
| Milestone anticipation | "What's next" + upcoming-milestone windows | Anticipation, J4 |
| Weekly digest (email) | Recap + locked-depth teaser | Win-back + conversion |
| Collections & notes | Personal investment in the app | Switching cost |
| Caregiver sync | Shared family context | Stickiness, Family plan |
| Assistant memory (P3) | Remembers prior questions/child context | Differentiation, retention |

## 5. Content surfacing rules (ported from the engine)
- Today card category = family rotation (no repeat within recent window).
- Tip selection respects **cooldown (21d default)**, novelty, stage boost, leap boost,
  difficulty, and rotation penalties (see [01-AUDIT.md §4](01-AUDIT.md) and TDD).
- Multi-child families: round-robin which child "leads" each day; all children renderable in
  a family view.
- Check-in (~1/3 days), milestone prompt (~1/4), share prompt (~1/10) — deterministic per
  parent/child/day so it's stable within a day.
