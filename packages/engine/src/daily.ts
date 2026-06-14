/**
 * Daily-tip rotation — stage-relative cooldown + least-seen-first selection.
 *
 * Implements DAILY_TIP_ROTATION_SPEC: a parent opening the app once a day sees a
 * fresh, relevant tip with widely-spaced repeats. The pool is the curated set of
 * daily-eligible tips for the child's CURRENT STAGE; a tip can't recur until ~70%
 * of the stage's other tips have appeared, and least-seen tips come first so the
 * whole library is covered before anything repeats.
 *
 * Pure + deterministic: callers supply the stage pool + the child's daily history,
 * the engine returns the pick. No DB access here.
 */
import { hashString } from "./hash.js";

/**
 * The daily knowledge base's own stage taxonomy (distinct from the engine's
 * developmental STAGES, which only reach ~10y). Ordered by upper bound; a child's
 * stage is the first band whose `maxAgeDays` covers their age. Labels match the
 * `stage` column on daily-eligible content_items exactly.
 */
export const DAILY_STAGES: readonly { label: string; maxAgeDays: number }[] = [
  { label: "0-1 month", maxAgeDays: 30 },
  { label: "1-3 months", maxAgeDays: 90 },
  { label: "3-6 months", maxAgeDays: 180 },
  { label: "6-9 months", maxAgeDays: 270 },
  { label: "9-12 months", maxAgeDays: 365 },
  { label: "12-18 months", maxAgeDays: 548 },
  { label: "18-24 months", maxAgeDays: 730 },
  { label: "2-3 years", maxAgeDays: 1095 },
  { label: "3-5 years", maxAgeDays: 2189 },
  { label: "6-8 years", maxAgeDays: 2920 },
  { label: "9-12 years", maxAgeDays: 4380 },
  { label: "13-15 years", maxAgeDays: 5475 },
  { label: "16-18 years", maxAgeDays: Number.POSITIVE_INFINITY },
] as const;

/** Resolve the daily-pool stage label for an age in days (clamps to the last band). */
export function dailyStageForAgeDays(ageDays: number): string {
  const a = Math.max(0, ageDays);
  for (const s of DAILY_STAGES) {
    if (a <= s.maxAgeDays) return s.label;
  }
  return DAILY_STAGES[DAILY_STAGES.length - 1]!.label;
}

export interface DailyTipCandidate {
  tip_id: string;
  /** Higher = surfaced earlier among equally-seen tips (CSV `priority`). */
  priority_weight: number;
}

/** Fraction of the stage pool kept on cooldown (no-repeat window). */
const COOLDOWN_FRACTION = 0.7;
/** Relaxed window used only if the 0.7 window leaves nothing eligible. */
const RELAXED_FRACTION = 0.5;

/**
 * Pick today's tip from a stage pool.
 *
 * @param candidates   daily-eligible tips for the child's current stage.
 * @param historyRecentFirst tip_ids of this child's past daily picks, most-recent first
 *                     (repeats allowed — used for both the recency window and times-shown).
 * @param seed         stable per-child/per-day string for deterministic tie-breaks.
 *
 * Steps (per spec):
 *  1. N = floor(0.70 * poolSize); exclude the last N distinct tips shown.
 *  2. Of the rest, pick the least-seen (lowest times-shown for this child);
 *     ties → higher priority, then a deterministic hash shuffle.
 *  3. If the window leaves nothing, relax to 0.50, then 0 (never hard-fail).
 *  4. Brand-new child (empty history) → highest priority, then hash shuffle.
 */
export function selectDailyTip<T extends DailyTipCandidate>(
  candidates: T[],
  historyRecentFirst: string[],
  seed: string,
): T | null {
  const poolSize = candidates.length;
  if (poolSize === 0) return null;

  const timesShown = new Map<string, number>();
  for (const id of historyRecentFirst) {
    timesShown.set(id, (timesShown.get(id) ?? 0) + 1);
  }

  const distinctRecent = (n: number): Set<string> => {
    const set = new Set<string>();
    if (n <= 0) return set;
    for (const id of historyRecentFirst) {
      set.add(id);
      if (set.size >= n) break;
    }
    return set;
  };

  const eligibleWith = (fraction: number): T[] => {
    const recent = distinctRecent(Math.floor(fraction * poolSize));
    return candidates.filter((c) => !recent.has(c.tip_id));
  };

  let eligible = eligibleWith(COOLDOWN_FRACTION);
  if (eligible.length === 0) eligible = eligibleWith(RELAXED_FRACTION);
  if (eligible.length === 0) eligible = candidates.slice();

  eligible.sort((a, b) => {
    const ta = timesShown.get(a.tip_id) ?? 0;
    const tb = timesShown.get(b.tip_id) ?? 0;
    if (ta !== tb) return ta - tb; // least-seen first
    if (a.priority_weight !== b.priority_weight) return b.priority_weight - a.priority_weight; // higher priority first
    return hashString(`${seed}|${a.tip_id}`) - hashString(`${seed}|${b.tip_id}`); // deterministic shuffle
  });

  return eligible[0] ?? null;
}
