# 04 — UX / Design System

## 1. Brand direction
**Friendly · Premium · Modern · Trustworthy.** Calm and reassuring, never clinical or
alarmist; warm but not childish. Think "a wise, gentle friend who happens to know child
development" — closer to Headspace/Calm's restraint than a bright baby-products aesthetic.

**Voice & tone:** second person, short sentences, present tense, action-oriented, always
ends on encouragement. Never shaming, never absolutist ("always/never"), never fear-based.
(This is exactly the tone already encoded in the content: *insight → try today → encouragement*.)

## 2. Design tokens

### Color (light)
| Token | Value | Use |
|-------|-------|-----|
| `--color-bg` | `#FBF9F6` | App background (warm off-white) |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-surface-alt` | `#F3EFE9` | Subtle sections |
| `--color-primary` | `#6B8F71` | Brand sage green (calm, growth) — primary actions |
| `--color-primary-press` | `#557159` | Pressed |
| `--color-accent` | `#E8A87C` | Warm peach — highlights, milestones |
| `--color-text` | `#2B2B2A` | Primary text |
| `--color-text-muted` | `#6E6A64` | Secondary |
| `--color-success` | `#5C9A6B` | |
| `--color-warning` | `#D9A441` | Gentle, not red |
| `--color-danger` | `#C2685A` | Safety/escalation only (muted terracotta, not alarm-red) |
| `--color-border` | `#E7E1D8` | Hairlines |

### Color (dark)
`--color-bg #1A1B19`, `--color-surface #232422`, `--color-primary #8FB295`,
`--color-text #ECE9E3`, `--color-text-muted #A6A199`. Maintain ≥4.5:1 contrast.

### Typography
- **Display/headings:** a humanist serif for warmth — e.g. *Fraunces* or *Source Serif*.
- **Body/UI:** *Inter* (excellent legibility, variable).
- Scale (pt): Display 32/40 · H1 26/34 · H2 20/28 · Body 16/24 · Small 14/20 · Caption 12/16.
- Generous line-height; max ~60 char measure for guidance text.

### Spacing & shape
4-pt grid (4/8/12/16/24/32/48). Card radius 20, button radius 14, full-pill for chips.
Soft shadows only (y2 blur8 8%); never harsh.

### Motion
Calm and quick: 200–250ms ease-out for transitions; gentle spring on the daily card reveal;
respect "reduce motion."

## 3. Component library
| Component | Notes |
|-----------|-------|
| **DailyCard** | Hero of Today. Insight (H2) · try-today action chip · encouragement (muted) · helpful/not-helpful · save. |
| **QuickActionBar** | Horizontal pills: Another · Sleep · Play · Feeding · Behavior · Ask. |
| **ChildSwitcher** | Avatar + name + age badge; sheet to switch/add. |
| **StageBadge** | Pill showing stage label + "Day N". |
| **MilestonePrompt** | Yes/Not yet; on Yes → date/photo capture. |
| **TimelineStageRow** | Stage band with current marker + milestone dots. |
| **TipDetailSheet** | Full content: insight, action, reassurance, signs-of-healthy, when-to-consult, sources. |
| **AssistantBubble** | Chat bubble + citations drawer + safety banner variant. |
| **CollectionCard / NoteEditor** | Saved content. |
| **Paywall** | Contextual upgrade sheet (trigger-aware copy). |
| **ConsentBlock** | TCPA SMS consent with exact disclosure copy (from `APP_CONFIG.optIn`). |
| **EmptyState / Skeleton / Toast / Banner** | Standard system. |

Accessibility: every component ships with a11y labels, min 44×44pt touch targets, and
dynamic-type support.

## 4. Accessibility standards
- WCAG **2.2 AA**: contrast ≥4.5:1 (text), ≥3:1 (large/UI), visible focus, no color-only meaning.
- Full screen-reader support (VoiceOver/TalkBack); semantic headings; ordered focus.
- Dynamic Type / font scaling up to 200% without truncation of guidance text.
- Reduce-motion + reduce-transparency honored. Captions on any video resource.
- Localizable strings (English first; architecture ready for i18n — content has
  `language`/`localization_region` fields already).

## 5. Key screen specifications

### 5.1 Today (Home)
- Header: greeting + date · ChildSwitcher (right).
- DailyCard for active child (insight/action/encouragement, helpful, save).
- QuickActionBar.
- "Daily activity" card.
- Contextual: MilestonePrompt or check-in (when scheduled).
- Below fold: recent days feed.
- States: loading skeleton · first-run (card generated immediately) · offline (last cached card).

### 5.2 Timeline
- Sticky stage map (horizontal stages, current highlighted).
- Current-stage detail: what's happening now + 2–3 "what's next" items.
- Milestone list: achieved (date, optional photo) vs upcoming (typical window).
- Keepsake export CTA (Premium).

### 5.3 Assistant (Phase 3)
- Child context chip (name · age) pinned at top.
- Suggested age-based questions when empty.
- Streaming answers; citations drawer; **safety banner** when escalation triggered
  ("This may need a doctor — here's why").
- Premium paywall on first question (Free tier).

### 5.4 Child profile / add child
- Name · birthdate (or **due date** toggle for pregnancy) · optional gender · photo.
- Caregivers list + invite (role picker).
- Live age + stage badge.

### 5.5 Onboarding
Mirrors the proven SMS FSM as a smooth multi-step flow with progress: sign-up → consent →
parent name → child name → birthdate → add-another loop → focus area → push permission →
**land on a populated Today card**.

### 5.6 Settings / Notifications
Per-channel toggles (push/SMS/email), quiet hours, preferred daily time (maps to
`preferred_time`/`timezone`), per-child prefs, plan/billing, privacy (export/delete/consent).

## 6. Design deliverables for build
- Figma library implementing the tokens + components above (or a code-first design system in
  the RN app — see TDD; recommended: **Tamagui** or **Restyle** tokens encoding this spec).
- Light + dark, mobile + web breakpoints (≤600 mobile, 601–1024 tablet, >1024 web).
