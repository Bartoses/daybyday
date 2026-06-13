# DaybyDay — Status & Roadmap

_Living snapshot as of 2026-06-13. For content + design planning._

---

## 1. What it is, where it lives

A parenting PWA: a daily, age-perfect tip per child, plus ask-a-question and a calm
reading experience. Installable to the home screen, with opt-in daily push.

| Piece | Where | URL |
|-------|-------|-----|
| Web app (Expo web) | Vercel | `daybyday-api.vercel.app` |
| API (Fastify) | Railway | `daybydayapi-production.up.railway.app` |
| Database + Auth | Supabase | project `wclfupgqlrtxptmhggbm` |
| Code | GitHub (public) | `github.com/Bartoses/daybyday` |

Deploys on `git push` (Railway + Vercel auto-build).

---

## 2. What's shipped ✅

- **Onboarding** — value-prop welcome, progress steps, multi-child, MM/DD/YYYY date pickers
- **Today** — daily card (engine-selected), child switcher, time-aware greeting + contextual "moment" banner (birthday / monthly milestone / season)
- **The card** — serif (Fraunces) headline, category chips w/ emoji, "Try this today" action block, reassurance, optional "Parents often wonder" + "Learn more"
- **Quick actions** — Another / Sleep / Play / Feeding / Behavior (unlimited; monetization off)
- **Ask & FAQ** — ask a question → keyword-matched tip; curated FAQ chips per age
- **Settings** — edit profile (name, focus), add/remove children, notification schedule (when + topics)
- **Push notifications** — install detection + smart nudge; per-user send time & topics; **admin broadcast tool** (custom messages, send-now or scheduled, email-gated `/admin`)
- **Engine** — age/stage fit, cooldown/novelty, category rotation, developmental-leap boost, **time-of-day boost** (evening→sleep, etc.); fully unit-tested
- **PWA** — installable (manifest, icons, service worker), Fraunces+Inter typography
- **Growth** — adaptive install/notification prompt on Today (after the card)

---

## 3. Content / knowledge base — health report

**1,061 active tips.** All have insight + action + reassurance. The gaps below are
where content work pays off most (every card reads better).

| Field | Populated | State / action |
|-------|-----------|----------------|
| insight, action_tip, reassurance | 1061 / 1061 | ✅ solid |
| `follow_up_prompt` (the "Parents often wonder" Q) | 618 good of 1061 | ⚠️ ~443 either repeat the insight or aren't questions → app hides those. **Rewrite as real parent questions.** |
| `development_focus` (the "Supports …" tag) | 600 good of 1061 | ⚠️ ~461 are long sentences → app hides them. **Make these short labels** (e.g. "fine motor", "sleep regulation"). |
| `when_to_consult_doctor` | 38 | 🔴 mostly empty. **Add a "when to check with your doctor" line** where relevant (builds trust/safety). |
| `signs_of_healthy_development` | 0 | 🔴 empty — powers "Learn more → Signs it's going well". **Great to add.** |
| `common_misunderstanding` | 0 | 🔴 empty — powers "Learn more → A common myth". **High-value, engaging.** |
| `milestone_key` | 0 | 🔴 empty — would enable milestone-window boosts + milestone tracking. |
| `youtube_resource_*`, `book_resource` | 0 | 🔴 empty — could add a "watch/read more" resource. |
| `seasonal_relevance` | (not imported) | 🔴 no season tags → season-aware tips not possible yet. Add a column + tags to enable. |

**Age coverage** (stage → tip count): strong 0–24 mo (89/83/77/72/72/75/112), heavy at
3–5 yr (283), **thin at school age**: 6–8 yr (45), 9–12 yr (30), 13–15 (27), 16–18 (24).
→ **Expand school-age + teen content.**

**Category mix** (good spread): emotional 258, development 199, learning_play 198,
sleep 142, behavior 119, feeding 88, safety 57.

### How content flows in
Edit the Google Sheet → export the **Knowledge** tab as CSV → run the importer:
`pnpm --filter @daybyday/import import -- --input <file>.csv --parity`.
It dedupes by the `id` column, maps ~130 raw category strings to the 7 app categories,
and upserts (re-import updates in place). The 7 app categories: **sleep, feeding,
development, learning_play, emotional, behavior, safety**.

---

## 4. Design system

- **Type**: Fraunces (display serif) for all headings + the card insight; Inter for body. Loaded via web fonts.
- **Palette**: bg `#FBF9F6`, surface `#FFF`, sage primary `#6B8F71`, peach accent `#E8A87C`, text `#2B2B2A`. Calm, warm, never clinical.
- **Category colors** (chips): sleep 🌙 indigo, feeding 🍽️ peach, development 🌱 sage, learning_play 🧩 amber, emotional 💛 gold, behavior 🧭 teal, safety 🛟 slate.
- **Tokens** live in `apps/mobile/src/theme.ts`; the card in `apps/mobile/src/components/TipCard.tsx`.
- **Open design opportunities**: a real designed app icon (current is a placeholder sage dot — swap `apps/mobile/public/icon-*.png`); illustrations/empty states; the timeline/profile screens (not built yet); dark mode polish.

---

## 5. Roadmap (prioritized)

### P0 — turn on the retention engine + fix content quality
- **Verify daily push is firing** — set `CRON_SECRET` in **both** Railway and the GitHub Actions repo secret; confirm via Actions → "Daily push reminders" → Run workflow.
- **Content cleanup** (biggest card-quality win): rewrite weak `follow_up_prompt`s into real questions; shorten `development_focus` to labels; add `when_to_consult_doctor`, `signs_of_healthy_development`, `common_misunderstanding`.

### P1 — habit + reach
- **Streak / progress** — "3 days in a row", tips-learned count (strong return driver).
- **Email digest** — weekly recap for people who don't install push (Resend).
- **Admin content types** — broadcast a real tip (by category) or a promo/ad, not just custom text.

### P2 — depth + virality
- **Saved tips / collections** — bookmark + revisit.
- **Sharing / referral** — share a tip; referral codes (schema field exists).
- **AI assistant** — real generated answers in Ask, grounded in content + a safety layer.

### P3 — breadth + infra
- **School-age / teen content** expansion (coverage thin past 5 yr).
- **Season + milestone temporal boosts** (need content tags first).
- **SMS leg**, timeline/profile screens, i18n, billing.
