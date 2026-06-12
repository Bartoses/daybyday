import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lightweight question → content matching (pre-assistant). Mirrors the legacy
 * `findKnowledgeByQuestion`: tokenise the question and score age-eligible active
 * tips by keyword/text overlap. The full AI-answered assistant lands in Phase 3;
 * this surfaces the most relevant existing tip as an immediate answer.
 */

interface MatchRow {
  tip_id: string;
  category: string;
  insight: string;
  action_tip: string;
  development_focus: string | null;
  keywords: string[];
  follow_up_prompt: string | null;
}

// Common words that carry no topical signal for matching.
const STOP = new Set([
  "what", "when", "why", "how", "does", "should", "with", "this", "that", "your",
  "child", "baby", "toddler", "kid", "about", "they", "them", "their", "have",
  "still", "just", "like", "into", "from", "will", "would", "could", "much",
  "many", "more", "some", "long", "make", "need", "want", "doing", "right", "now",
]);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
}

/**
 * Returns the tip_id of the best-matching age-eligible tip for a question, or
 * null when nothing meaningfully matches.
 */
export async function matchTipForQuestion(
  db: SupabaseClient,
  ageDays: number,
  questionText: string,
): Promise<string | null> {
  const tokens = tokenize(questionText);
  if (tokens.length === 0) return null;

  const { data } = await db
    .from("content_items")
    .select("tip_id, category, insight, action_tip, development_focus, keywords, follow_up_prompt")
    .eq("active", true)
    .lte("age_min_days", ageDays)
    .gte("age_max_days", ageDays);

  const rows = (data ?? []) as MatchRow[];
  let best: string | null = null;
  let bestScore = 0;

  for (const r of rows) {
    const hay = `${(r.keywords ?? []).join(" ")} ${r.insight} ${r.action_tip} ${r.category} ${r.development_focus ?? ""} ${r.follow_up_prompt ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = r.tip_id;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Curated FAQ for a child's age: distinct `follow_up_prompt` questions, one per
 * category first (for variety) then topped up, capped at `limit`.
 */
export async function faqForAge(
  db: SupabaseClient,
  ageDays: number,
  limit = 6,
): Promise<string[]> {
  const { data } = await db
    .from("content_items")
    .select("category, follow_up_prompt")
    .eq("active", true)
    .lte("age_min_days", ageDays)
    .gte("age_max_days", ageDays)
    .not("follow_up_prompt", "is", null);

  const rows = (data ?? []) as Array<{ category: string; follow_up_prompt: string | null }>;
  const seenCategory = new Set<string>();
  const seenQuestion = new Set<string>();
  const out: string[] = [];

  // First pass: one distinct prompt per category for topical spread.
  for (const r of rows) {
    const q = (r.follow_up_prompt ?? "").trim();
    if (!q || seenQuestion.has(q) || seenCategory.has(r.category)) continue;
    seenCategory.add(r.category);
    seenQuestion.add(q);
    out.push(q);
    if (out.length >= limit) return out;
  }

  // Second pass: fill remaining slots with any other distinct prompts.
  for (const r of rows) {
    const q = (r.follow_up_prompt ?? "").trim();
    if (!q || seenQuestion.has(q)) continue;
    seenQuestion.add(q);
    out.push(q);
    if (out.length >= limit) break;
  }

  return out;
}
