/**
 * AI content generator — deepens thin daily-tip pools.
 *
 * Finds (stage × category) cells in content_items that have fewer than --target
 * daily-eligible tips and uses Claude to write additional ones in the same shape,
 * then upserts them (tagged reviewer='ai-generated', tip_id prefix `ai_` so they're
 * easy to audit or remove). Deterministic tip_ids (hash of the insight) make
 * re-runs idempotent. Rotation/serving is unchanged — this just adds variety.
 *
 * Usage (from repo root):
 *   pnpm --filter @daybyday/import run generate -- --dry-run
 *   pnpm --filter @daybyday/import run generate -- --categories feeding
 *   pnpm --filter @daybyday/import run generate -- --target 12 --max-cells 5
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY (repo-root .env).
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CATEGORIES = ["sleep", "feeding", "development", "learning_play", "emotional", "behavior", "safety"] as const;
type Category = (typeof CATEGORIES)[number];

/** Stage label → age-day band + slug, matching the daily-pool stage taxonomy. */
const STAGE_RANGES: { label: string; min: number; max: number; slug: string }[] = [
  { label: "0-1 month", min: 0, max: 30, slug: "0_1m" },
  { label: "1-3 months", min: 31, max: 90, slug: "1_3m" },
  { label: "3-6 months", min: 91, max: 180, slug: "3_6m" },
  { label: "6-9 months", min: 181, max: 270, slug: "6_9m" },
  { label: "9-12 months", min: 271, max: 365, slug: "9_12m" },
  { label: "12-18 months", min: 366, max: 548, slug: "12_18m" },
  { label: "18-24 months", min: 549, max: 730, slug: "18_24m" },
  { label: "2-3 years", min: 731, max: 1095, slug: "2_3y" },
  { label: "3-5 years", min: 1096, max: 2189, slug: "3_5y" },
  { label: "6-8 years", min: 2190, max: 2920, slug: "6_8y" },
  { label: "9-12 years", min: 2921, max: 4380, slug: "9_12y" },
  { label: "13-15 years", min: 4381, max: 5475, slug: "13_15y" },
  { label: "16-18 years", min: 5476, max: 6570, slug: "16_18y" },
];

interface GeneratedTip {
  insight: string;
  action: string;
  reassurance: string;
  development_focus: string;
  follow_up_prompt: string;
  when_to_consult_doctor?: string | null;
}

interface ContentRow {
  tip_id: string;
  category: Category;
  age_min_days: number;
  age_max_days: number;
  stage: string;
  insight: string;
  action_tip: string;
  reassurance: string;
  development_focus: string | null;
  follow_up_prompt: string | null;
  when_to_consult_doctor: string | null;
  difficulty_level: "easy";
  priority_weight: number;
  cooldown_days: number;
  message_type: "daily";
  rotation_group: string;
  keywords: string[];
  active: true;
  daily_eligible: true;
  reviewer: string;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

interface Args {
  target: number;
  maxCells: number;
  stages: string[] | null;
  categories: Category[] | null;
  dryRun: boolean;
  out: string | null;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { target: 12, maxCells: Infinity, stages: null, categories: null, dryRun: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--target") a.target = Number(argv[++i]);
    else if (v === "--max-cells") a.maxCells = Number(argv[++i]);
    else if (v === "--stages") a.stages = String(argv[++i]).split(",").map((s) => s.trim());
    else if (v === "--categories") a.categories = String(argv[++i]).split(",").map((s) => s.trim()) as Category[];
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--out") a.out = argv[++i] ?? null;
  }
  return a;
}

interface Cell {
  stage: string;
  category: Category;
  min: number;
  max: number;
  slug: string;
  count: number;
  insights: string[];
  need: number;
}

async function buildCells(db: SupabaseClient, args: Args): Promise<Cell[]> {
  const { data, error } = await db
    .from("content_items")
    .select("stage, category, insight")
    .eq("active", true)
    .eq("daily_eligible", true);
  if (error) throw new Error(error.message);
  const rows = (data as { stage: string | null; category: string; insight: string }[] | null) ?? [];

  const byCell = new Map<string, { count: number; insights: string[] }>();
  for (const r of rows) {
    if (!r.stage) continue;
    const k = `${r.stage}|${r.category}`;
    const e = byCell.get(k) ?? { count: 0, insights: [] };
    e.count += 1;
    if (e.insights.length < 40) e.insights.push(r.insight);
    byCell.set(k, e);
  }

  const cells: Cell[] = [];
  for (const sr of STAGE_RANGES) {
    if (args.stages && !args.stages.includes(sr.label)) continue;
    for (const category of CATEGORIES) {
      if (args.categories && !args.categories.includes(category)) continue;
      const e = byCell.get(`${sr.label}|${category}`) ?? { count: 0, insights: [] };
      const need = args.target - e.count;
      if (need <= 0) continue;
      cells.push({ stage: sr.label, category, min: sr.min, max: sr.max, slug: sr.slug, count: e.count, insights: e.insights, need });
    }
  }
  return cells.sort((a, b) => b.need - a.need);
}

const SYSTEM = `You are an expert pediatric parenting-content writer for a calm, warm daily-tips app.
Write practical, evidence-informed daily tips for parents of a child at a specific developmental stage and topic.
Each tip must be:
- Specific and concrete (a parent can act on it today), tailored to the stage.
- Warm and reassuring, never clinical or preachy.
- Safe: NEVER give medical diagnosis, medication, or dosing advice. For genuine health/safety concerns, defer to a pediatrician.
Avoid duplicating the existing tips provided.
Return ONLY a JSON array, no prose, where each element is:
{"insight": "1-2 sentence why/what (the idea)", "action": "one concrete thing to try today", "reassurance": "one warm sentence", "development_focus": "a short 1-4 word label e.g. 'fine motor'", "follow_up_prompt": "a real question a parent at this stage might ask", "when_to_consult_doctor": "one sentence, or null if not applicable"}`;

async function generateForCell(client: Anthropic, model: string, cell: Cell): Promise<GeneratedTip[]> {
  const existing = cell.insights.slice(0, 20).map((s) => `- ${s}`).join("\n") || "(none yet)";
  const user = `Stage: ${cell.stage}. Topic/category: ${cell.category}. Write ${cell.need} NEW daily tips.
Existing tips for this stage+topic (do not repeat these ideas):
${existing}`;

  const res = await client.messages.create({
    model,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error(`No JSON array in response for ${cell.stage}/${cell.category}`);
  const parsed = JSON.parse(text.slice(start, end + 1)) as GeneratedTip[];
  return parsed.filter((t) => t && t.insight && t.action && t.reassurance);
}

function toRow(cell: Cell, t: GeneratedTip): ContentRow {
  return {
    tip_id: `ai_${cell.slug}_${cell.category}_${hash(t.insight)}`,
    category: cell.category,
    age_min_days: cell.min,
    age_max_days: cell.max,
    stage: cell.stage,
    insight: t.insight.trim(),
    action_tip: t.action.trim(),
    reassurance: t.reassurance.trim(),
    development_focus: t.development_focus?.trim() || null,
    follow_up_prompt: t.follow_up_prompt?.trim() || null,
    when_to_consult_doctor: t.when_to_consult_doctor?.trim() || null,
    difficulty_level: "easy",
    priority_weight: 1.2,
    cooldown_days: 21,
    message_type: "daily",
    rotation_group: cell.category,
    keywords: [],
    active: true,
    daily_eligible: true,
    reviewer: "ai-generated",
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const anthropicKey = process.env["ANTHROPIC_API_KEY"];
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const model = process.env["CONTENT_MODEL"] ?? "claude-sonnet-4-6";
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const client = new Anthropic({ apiKey: anthropicKey });

  const allCells = await buildCells(db, args);
  const cells = allCells.slice(0, Number.isFinite(args.maxCells) ? args.maxCells : allCells.length);
  const totalNeed = cells.reduce((s, c) => s + c.need, 0);

  console.log(`Target ${args.target}/cell. Cells below target: ${allCells.length} (processing ${cells.length}). Tips to generate: ${totalNeed}`);
  for (const c of cells.slice(0, 30)) console.log(`  ${c.stage} / ${c.category}: have ${c.count}, need ${c.need}`);
  if (args.dryRun) {
    console.log("\n--dry-run: no API calls, no writes.");
    return;
  }
  if (totalNeed === 0) {
    console.log("Nothing to do.");
    return;
  }

  const rows: ContentRow[] = [];
  for (const cell of cells) {
    process.stdout.write(`Generating ${cell.need} for ${cell.stage}/${cell.category}… `);
    try {
      const tips = await generateForCell(client, model, cell);
      const cellRows = tips.map((t) => toRow(cell, t));
      rows.push(...cellRows);
      console.log(`got ${cellRows.length}`);
    } catch (e) {
      console.log(`FAILED: ${(e as Error).message}`);
    }
  }

  // Dedupe by tip_id (hash collisions / repeats across the run).
  const deduped = Array.from(new Map(rows.map((r) => [r.tip_id, r])).values());
  if (args.out) {
    writeFileSync(args.out, JSON.stringify(deduped, null, 2));
    console.log(`\nWrote ${deduped.length} rows to ${args.out} for review.`);
  }

  let upserted = 0;
  for (let i = 0; i < deduped.length; i += 200) {
    const batch = deduped.slice(i, i + 200);
    const { error, count } = await db.from("content_items").upsert(batch, { onConflict: "tip_id", count: "exact" });
    if (error) console.error(`  upsert error: ${error.message}`);
    else upserted += count ?? batch.length;
  }
  console.log(`\nUpserted ${upserted} AI-generated tips (reviewer='ai-generated', tip_id prefix 'ai_').`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
