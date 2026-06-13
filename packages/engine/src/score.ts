/**
 * Tip scoring + selection — the migrated IP. Ported from
 * knowledge_generator.js `scoreKnowledgeRow_` / `scoreKnowledgePool_` /
 * `chooseNormalizedKnowledgeRow_`.
 *
 * Pure and deterministic: given the same candidates, history, age, category and
 * reference time it always returns the same pick. All DB I/O lives in the caller.
 */

import type { Category } from "@daybyday/schemas";
import { ENGINE_CONFIG } from "./config.js";
import type { LeapContext } from "./leap.js";
import { requestedCategoryAliases } from "./topic.js";

/** A content_items row, narrowed to the fields scoring needs. */
export interface Candidate {
  tip_id: string;
  category: Category;
  rotation_group: string | null;
  stage: string | null;
  age_min_days: number;
  age_max_days: number;
  priority_weight: number;
  cooldown_days: number;
  difficulty_level: string;
  active: boolean;
}

/** A prior `messages` row for the same child, most-recent-first. */
export interface HistoryEntry {
  tip_id: string;
  /** ISO timestamp the tip was sent (sent_at, falling back to send_date). */
  sent_at: string;
  /** category_family / topic of the sent tip (DB category). */
  topic: Category | null;
  rotation_group: string | null;
}

export interface ScoreInput {
  ageDays: number;
  preferredCategory: Category;
  /** Stages considered "on target" — typically [stageForAgeDays(ageDays)]. */
  preferredStages: string[];
  history: HistoryEntry[];
  leapContext: LeapContext | null;
  /** Local time-of-day context for temporal category biasing (null = no bias). */
  temporal?: TemporalContext | null;
  /** Reference "now" for cooldown math (defaults to Date.now()). */
  now: Date;
}

/** Local clock context used to bias categories by time of day. */
export interface TemporalContext {
  /** Local hour 0–23 in the family's timezone. */
  hour: number;
}

/** Categories that get a boost during an active leap window (legacy set, DB terms). */
const LEAP_BOOST_CATEGORIES: ReadonlySet<Category> = new Set(["sleep", "emotional", "behavior"]);

// Time-of-day → categories that feel most relevant then.
const MORNING: ReadonlySet<Category> = new Set(["feeding", "learning_play", "development"]);
const MIDDAY: ReadonlySet<Category> = new Set(["learning_play", "development", "behavior"]);
const EVENING: ReadonlySet<Category> = new Set(["sleep", "emotional", "behavior"]);
const NIGHT: ReadonlySet<Category> = new Set(["sleep", "emotional"]);

/** Preferred categories for a given local hour. */
export function preferredCategoriesForHour(hour: number): ReadonlySet<Category> {
  if (hour >= 5 && hour < 11) return MORNING;
  if (hour >= 11 && hour < 17) return MIDDAY;
  if (hour >= 17 && hour < 22) return EVENING;
  return NIGHT;
}

/**
 * Score a single candidate. Returns `null` when the tip is inside its cooldown
 * window and must be excluded entirely (mirrors the legacy `return null`).
 */
export function scoreCandidate(candidate: Candidate, input: ScoreInput): number | null {
  const { ageDays, preferredCategory, preferredStages, history, leapContext, now } = input;

  let score = Number(candidate.priority_weight || 1) * 10;
  const category = candidate.category;
  const rotationGroup = (candidate.rotation_group || category).trim();
  const targetStage = (candidate.stage || "").trim();

  // Locate the most recent send of this exact tip.
  let lastSentAt: string | null = null;
  for (const h of history) {
    if (String(h.tip_id) === String(candidate.tip_id)) {
      lastSentAt = h.sent_at;
      break;
    }
  }

  if (lastSentAt) {
    const daysSince = Math.floor(
      (now.getTime() - new Date(lastSentAt).getTime()) / (24 * 60 * 60 * 1000),
    );
    const cooldown = Number(candidate.cooldown_days || ENGINE_CONFIG.defaultCooldownDays);
    if (daysSince < cooldown) {
      return null; // still cooling down — exclude
    }
    score -= ENGINE_CONFIG.repeatPenalty;
  } else {
    score += ENGINE_CONFIG.noveltyWeight;
  }

  if (requestedCategoryAliases(preferredCategory).includes(category)) {
    score += ENGINE_CONFIG.preferredTopicBoost;
  }

  if (preferredStages.includes(targetStage)) {
    score += ENGINE_CONFIG.stageBoostWeight;
  }

  const ageMidpoint = (Number(candidate.age_min_days) + Number(candidate.age_max_days)) / 2;
  score -= Math.min(Math.abs(ageDays - ageMidpoint), ENGINE_CONFIG.ageMidpointCap);

  // Recency penalties decay with distance into history (÷ (i+1)).
  for (let i = 0; i < history.length; i += 1) {
    if (history[i]!.topic === category) {
      score -= ENGINE_CONFIG.categoryRotationPenalty / (i + 1);
    }
    if ((history[i]!.rotation_group || "").trim() === rotationGroup) {
      score -= ENGINE_CONFIG.rotationGroupPenalty / (i + 1);
    }
  }

  if (leapContext?.inLeapWindow && LEAP_BOOST_CATEGORIES.has(category)) {
    score += ENGINE_CONFIG.leapBoostWeight;
  }

  // Time-of-day bias: gently surface categories that fit the moment (evening →
  // sleep/wind-down, morning → feeding/play). Soft enough not to override age fit.
  if (input.temporal && preferredCategoriesForHour(input.temporal.hour).has(category)) {
    score += ENGINE_CONFIG.timeOfDayBoost;
  }

  score -= ENGINE_CONFIG.difficultyPenalty[String(candidate.difficulty_level || "easy").toLowerCase()] ?? 0;

  return score;
}

interface Scored {
  row: Candidate;
  score: number;
}

/** Score a pool and sort by score desc, tie-break by tip_id asc. Port of `scoreKnowledgePool_`. */
export function scorePool(candidates: Candidate[], input: ScoreInput): Scored[] {
  const scored: Scored[] = [];
  for (const c of candidates) {
    const score = scoreCandidate(c, input);
    if (score !== null) scored.push({ row: c, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.row.tip_id).localeCompare(String(b.row.tip_id));
  });
  return scored;
}

function filterByTopic(candidates: Candidate[], preferredCategory: Category): Candidate[] {
  const aliases = requestedCategoryAliases(preferredCategory);
  return candidates.filter((c) => aliases.includes(c.category));
}

function exactAgeRows(candidates: Candidate[], ageDays: number): Candidate[] {
  return candidates.filter((c) => ageDays >= c.age_min_days && ageDays <= c.age_max_days);
}

function nearAgeRows(candidates: Candidate[], ageDays: number, windowDays: number): Candidate[] {
  const minAge = Math.max(ageDays - windowDays, 0);
  const maxAge = ageDays + windowDays;
  return candidates.filter((c) => c.age_max_days >= minAge && c.age_min_days <= maxAge);
}

/**
 * Select the best content item for a child. Port of `chooseNormalizedKnowledgeRow_`.
 *
 * Tries four pools in order and returns the top of the first non-empty one:
 *   1. exact-age + preferred category
 *   2. exact-age (any category)
 *   3. near-age + preferred category
 *   4. near-age (any category)
 *
 * @param candidates ALL active content items (filtering happens inside).
 * @returns the chosen candidate, or null if nothing is eligible.
 */
export function selectContentItem(candidates: Candidate[], input: ScoreInput): Candidate | null {
  const active = candidates.filter((c) => c.active);
  const exact = exactAgeRows(active, input.ageDays);
  const near = nearAgeRows(active, input.ageDays, ENGINE_CONFIG.nearbyAgeWindowDays);

  const pools: Candidate[][] = [
    filterByTopic(exact, input.preferredCategory),
    exact,
    filterByTopic(near, input.preferredCategory),
    near,
  ];

  for (const pool of pools) {
    const scored = scorePool(pool, input);
    if (scored.length > 0) return scored[0]!.row;
  }

  return null;
}
