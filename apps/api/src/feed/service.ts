import type { SupabaseClient } from "@supabase/supabase-js";
import {
  renderCard,
  ageDaysFromBirthdate,
  stageForAgeDays,
  dailyStageForAgeDays,
  selectDailyTip,
  type Candidate,
} from "@daybyday/engine";
import { STAGES, type Category } from "@daybyday/schemas";

/** content_items row enriched with the render fields. */
interface ContentRow extends Candidate {
  daily_eligible: boolean;
  insight: string;
  action_tip: string;
  reassurance: string;
  when_to_consult_doctor: string | null;
  signs_of_healthy_development: string | null;
  common_misunderstanding: string | null;
  development_focus: string | null;
  follow_up_prompt: string | null;
  youtube_resource_title: string | null;
  youtube_resource_link: string | null;
}

export interface ChildRow {
  id: string;
  parent_id: string;
  name: string;
  birthdate: string | null;
  due_date: string | null;
}

export interface FeedCardResult {
  child_id: string;
  date: string;
  tip_id: string;
  category: Category;
  stage: string | null;
  insight: string;
  action_tip: string;
  reassurance: string;
  when_to_consult_doctor: string | null;
  signs_of_healthy_development: string | null;
  common_misunderstanding: string | null;
  development_focus: string | null;
  follow_up_prompt: string | null;
  youtube_title: string | null;
  youtube_url: string | null;
  sources: string[];
  saved: boolean;
}

const CONTENT_COLUMNS =
  "tip_id, category, rotation_group, stage, age_min_days, age_max_days, priority_weight, cooldown_days, difficulty_level, active, daily_eligible, insight, action_tip, reassurance, when_to_consult_doctor, signs_of_healthy_development, common_misunderstanding, development_focus, follow_up_prompt, youtube_resource_title, youtube_resource_link";

/** Stage label for an age, matching the legacy getStageForAgeDays output. */
function stageLabelForAge(ageDays: number): string | null {
  const key = stageForAgeDays(ageDays);
  if (!key) return null;
  return STAGES.find((s) => s.key === key)?.label ?? null;
}

/** Compute the child's age in days from birthdate (fallback 0 for pre-birth). */
export function childAgeDays(child: ChildRow, now: Date): number {
  if (!child.birthdate) return 0;
  return Math.max(0, ageDaysFromBirthdate(child.birthdate, now));
}

/** YYYY-MM-DD for the given date (UTC date key; tz refinement is a later concern). */
export function dateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

async function loadActiveContent(db: SupabaseClient): Promise<ContentRow[]> {
  // The serving layer draws only from the curated daily-eligible pool; the legacy
  // library stays in the table (daily_eligible = false) but dormant.
  const { data, error } = await db
    .from("content_items")
    .select(CONTENT_COLUMNS)
    .eq("active", true)
    .eq("daily_eligible", true);
  if (error) throw new Error(`content_items load failed: ${error.message}`);
  return (data as ContentRow[] | null) ?? [];
}

/**
 * This child's past daily picks, most-recent first (repeats included). Powers the
 * rotation's recency window + times-shown counts. Read from `messages`, which
 * already logs one daily pick per child per day (see messages_daily_unique_idx).
 */
async function loadDailyHistory(db: SupabaseClient, childId: string): Promise<string[]> {
  const { data } = await db
    .from("messages")
    .select("tip_id, send_date, created_at")
    .eq("child_id", childId)
    .eq("message_type", "daily")
    .order("send_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400);
  return ((data as { tip_id: string | null }[] | null) ?? [])
    .map((r) => String(r.tip_id ?? ""))
    .filter(Boolean);
}

/**
 * Every tip this child has been shown, most-recent first (repeats included, any
 * channel/type). Powers least-seen-first rotation for quick-actions so a tap won't
 * echo today's tip or a recent quick pick, and cycles the whole category first.
 */
async function loadShownHistory(db: SupabaseClient, childId: string): Promise<string[]> {
  const { data } = await db
    .from("messages")
    .select("tip_id, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(600);
  return ((data as { tip_id: string | null }[] | null) ?? [])
    .map((r) => String(r.tip_id ?? ""))
    .filter(Boolean);
}

function toCard(child: ChildRow, content: ContentRow, ageDays: number, now: Date): FeedCardResult {
  const rendered = renderCard(content);
  return {
    child_id: child.id,
    date: dateKey(now),
    tip_id: content.tip_id,
    category: content.category,
    stage: stageLabelForAge(ageDays),
    insight: rendered.insight,
    action_tip: rendered.action_tip,
    reassurance: rendered.reassurance,
    when_to_consult_doctor: content.when_to_consult_doctor,
    signs_of_healthy_development: content.signs_of_healthy_development,
    common_misunderstanding: content.common_misunderstanding,
    development_focus: content.development_focus,
    follow_up_prompt: content.follow_up_prompt,
    youtube_title: content.youtube_resource_title,
    youtube_url: content.youtube_resource_link,
    sources: [],
    saved: false,
  };
}

export interface SelectOptions {
  /** Explicit category for quick-actions; null lets the engine rotate. */
  requestedCategory?: Category | null;
  /** Distinguishes the daily seed from a follow-up seed. */
  isDaily: boolean;
  lookbackDays?: number;
  /** IANA timezone for time-of-day biasing (defaults to America/Denver). */
  timezone?: string;
  now?: Date;
}

/** Calendar date (YYYY-MM-DD) in the given IANA timezone. Used to dedupe the
 * daily push to once per the PARENT'S local day, not the UTC day. */
export function localDateKey(now: Date, timezone: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/Denver",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Local hour (0–23) in the given IANA timezone, for time-of-day boosting. */
export function localHour(now: Date, timezone: string | undefined): number {
  try {
    const s = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/Denver",
      hour: "numeric",
      hour12: false,
    }).format(now);
    const h = parseInt(s, 10);
    if (!Number.isFinite(h)) return now.getHours();
    return h === 24 ? 0 : h;
  } catch {
    return now.getHours();
  }
}

/**
 * Core selection: pick the best content item for a child and return a render-ready
 * card (without persisting). Used by both the daily feed and quick-actions.
 * Returns null only if no content is eligible at all.
 */
export async function selectFeedCard(
  db: SupabaseClient,
  parentId: string,
  child: ChildRow,
  opts: SelectOptions,
): Promise<FeedCardResult | null> {
  const now = opts.now ?? new Date();
  const ageDays = childAgeDays(child, now);
  const content = await loadActiveContent(db);

  // Daily tip: stage-relative cooldown + least-seen-first (DAILY_TIP_ROTATION_SPEC).
  // Draws from the child's current-stage pool only; quick-actions keep the richer
  // category/leap/time-of-day engine below.
  if (opts.isDaily) {
    const stageLabel = dailyStageForAgeDays(ageDays);
    const stagePool = content.filter((c) => c.stage === stageLabel);
    const candidates = stagePool.length > 0 ? stagePool : content; // never hard-fail
    const dailyHistory = await loadDailyHistory(db, child.id);
    const chosen = selectDailyTip(candidates, dailyHistory, `${child.id}:${dateKey(now)}`);
    if (!chosen) return null;
    return toCard(child, chosen, ageDays, now);
  }

  // Quick-action: least-seen-first within the requested category, so repeated taps
  // cycle the whole stage pool before anything repeats (no more "slight variations").
  const stageLabel = dailyStageForAgeDays(ageDays);
  const stagePool = content.filter((c) => c.stage === stageLabel);
  const explicit = opts.requestedCategory ?? null;
  let candidates = explicit ? stagePool.filter((c) => c.category === explicit) : stagePool;
  // Never hard-fail: fall back to the whole stage pool, then all content.
  if (candidates.length === 0) candidates = stagePool.length > 0 ? stagePool : content;

  const shown = await loadShownHistory(db, child.id);
  // Distinct per-request seed so tie-breaks vary; least-seen-first does the rotating.
  const chosen = selectDailyTip(candidates, shown, `${child.id}:qa:${now.getTime()}`);
  if (!chosen) return null;
  return toCard(child, chosen, ageDays, now);
}

/** Find the content row for a tip_id (to re-render a previously logged card). */
export async function loadCardByTip(
  db: SupabaseClient,
  child: ChildRow,
  tipId: string,
  now: Date,
): Promise<FeedCardResult | null> {
  const { data } = await db
    .from("content_items")
    .select(CONTENT_COLUMNS)
    .eq("tip_id", tipId)
    .maybeSingle();
  if (!data) return null;
  return toCard(child, data as ContentRow, childAgeDays(child, now), now);
}
