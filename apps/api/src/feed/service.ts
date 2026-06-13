import type { SupabaseClient } from "@supabase/supabase-js";
import {
  selectContentItem,
  renderCard,
  leapContextForAge,
  resolveFamilyCategory,
  ageDaysFromBirthdate,
  stageForAgeDays,
  type Candidate,
  type HistoryEntry,
} from "@daybyday/engine";
import { STAGES, type Category } from "@daybyday/schemas";

/** content_items row enriched with the render fields. */
interface ContentRow extends Candidate {
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
  "tip_id, category, rotation_group, stage, age_min_days, age_max_days, priority_weight, cooldown_days, difficulty_level, active, insight, action_tip, reassurance, when_to_consult_doctor, signs_of_healthy_development, common_misunderstanding, development_focus, follow_up_prompt, youtube_resource_title, youtube_resource_link";

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
  const { data, error } = await db.from("content_items").select(CONTENT_COLUMNS).eq("active", true);
  if (error) throw new Error(`content_items load failed: ${error.message}`);
  return (data as ContentRow[] | null) ?? [];
}

/** Recent message history for a child, most-recent-first, enriched with rotation_group. */
async function loadHistory(
  db: SupabaseClient,
  childId: string,
  content: ContentRow[],
  lookbackDays: number,
  now: Date,
): Promise<HistoryEntry[]> {
  const since = new Date(now.getTime() - lookbackDays * 86400000).toISOString();
  const { data } = await db
    .from("messages")
    .select("tip_id, category_family, sent_at, created_at, send_date")
    .eq("child_id", childId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const rotationByTip = new Map(content.map((c) => [c.tip_id, c.rotation_group] as const));

  return (data ?? []).map((row): HistoryEntry => {
    const r = row as Record<string, string | null>;
    return {
      tip_id: String(r["tip_id"] ?? ""),
      sent_at: String(r["sent_at"] ?? r["created_at"] ?? r["send_date"] ?? ""),
      topic: (r["category_family"] as Category | null) ?? null,
      rotation_group: rotationByTip.get(String(r["tip_id"] ?? "")) ?? null,
    };
  });
}

/** Recent categories for a child (most-recent-first), for rotation. */
function recentCategories(history: HistoryEntry[], limit: number): Category[] {
  const out: Category[] = [];
  for (const h of history) {
    if (h.topic && !out.includes(h.topic) && out.length < limit) out.push(h.topic);
  }
  return out;
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

/** Local hour (0–23) in the given IANA timezone, for time-of-day boosting. */
function localHour(now: Date, timezone: string | undefined): number {
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
  const history = await loadHistory(db, child.id, content, opts.lookbackDays ?? 45, now);

  const explicit = opts.requestedCategory ?? null;
  const category = resolveFamilyCategory(
    explicit,
    parentId,
    dateKey(now),
    recentCategories(history, 4),
    opts.isDaily,
  );

  const stageLabel = stageLabelForAge(ageDays);
  const stageKey = stageForAgeDays(ageDays);
  // Pass both label + key so the stage boost fires regardless of which form the
  // imported content stored (sheets used labels; schema enums use keys).
  const preferredStages = [stageLabel, stageKey].filter((s): s is string => Boolean(s));

  const chosen = selectContentItem(content, {
    ageDays,
    preferredCategory: category,
    preferredStages,
    history,
    leapContext: leapContextForAge(ageDays),
    temporal: { hour: localHour(now, opts.timezone) },
    now,
  });

  if (!chosen) return null;
  return toCard(child, chosen as ContentRow, ageDays, now);
}

/** Find the content row for a tip_id (to re-render a previously logged card). */
export async function loadCardByTip(
  db: SupabaseClient,
  child: ChildRow,
  tipId: string,
  now: Date,
): Promise<FeedCardResult | null> {
  const { data } = await db.from("content_items").select(CONTENT_COLUMNS).eq("tip_id", tipId).maybeSingle();
  if (!data) return null;
  return toCard(child, data as ContentRow, childAgeDays(child, now), now);
}
