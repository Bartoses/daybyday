# DaybyDay — Product & Engineering Documentation

> **The parenting companion that grows with families, one day at a time.**

This folder is the complete, build-ready specification for transforming DaybyDay from a
Google-Sheets + Apps-Script SMS system into a world-class iOS / Android / Web parenting
platform — **without losing the working content engine that exists today.**

## Reading order

| # | Document | What it covers | Primary audience |
|---|----------|----------------|------------------|
| 01 | [Audit](01-AUDIT.md) | Reverse-engineered existing system: data model, workflows, content engine, risks | Everyone |
| 02 | [Product Requirements (PRD)](02-PRD.md) | Vision, principles, feature set, monetization | PM, design, eng |
| 03 | [Information Architecture](03-INFORMATION-ARCHITECTURE.md) | Sitemap, navigation, user journeys, engagement loops | PM, design |
| 04 | [UX / Design System](04-DESIGN-SYSTEM.md) | Brand, tokens, components, screen specs, accessibility | Design, mobile eng |
| 05 | [Technical Architecture](05-TECHNICAL-ARCHITECTURE.md) | Stack choices, RN vs Flutter, infra, tradeoffs | Eng |
| 06 | [AI Architecture](06-AI-ARCHITECTURE.md) | Knowledge, RAG, personalization, safety, memory, recommendations | AI eng |
| 07 | [Database Design](07-DATABASE-DESIGN.md) | Postgres schema, Sheets→Postgres migration, RLS | DB / backend eng |
| 08 | [API Specification](08-API-SPEC.md) | REST endpoints, auth, payloads, errors | Backend / mobile eng |
| 09 | [Roadmap](09-ROADMAP.md) | 4 phases: features, effort, dependencies, risks, metrics | PM, leadership |
| 10 | [Build Plan](10-BUILD-PLAN.md) | Epics → features → stories → tasks → acceptance criteria | Claude Code |

## The three decisions that shaped this plan

1. **SMS runs in parallel.** The legacy Apps Script keeps serving SMS untouched; the new
   backend powers the apps. SMS is migrated, then sunset on a defined trigger — no risky cutover.
2. **Curated content first, AI later.** Phases 1–2 ship a polished daily feed / timeline /
   profiles from existing content. The Claude RAG assistant + safety layer land in Phase 3.
3. **Greenfield, best-of-breed stack.** Expo / React Native (one codebase → iOS + Android +
   web) on Supabase (Postgres + Auth + Storage + RLS), Twilio retained only for the SMS leg.

## Current reality (grounding facts)

- **Zero live users** → no PII migration, no re-consent, no cutover risk. The asset to
  preserve is the **knowledge content** and the **tip-selection logic**, not user data.
- Content currently spans **0–2190 days (0–6 yr)**, uneven, hand-maintained in a 190-column
  sheet. Expanding and cleaning it is a Phase-1 workstream, not an afterthought.
- The existing engine is genuinely good: 8 developmental stages, weighted tip selection with
  cooldowns and rotation, sibling-aware family rendering. **Carry it forward; don't reinvent it.**

## Status

All ten requested steps are specified here. Phase 1 in [10-BUILD-PLAN.md](10-BUILD-PLAN.md)
is detailed to the task level so Claude Code can begin immediately.
