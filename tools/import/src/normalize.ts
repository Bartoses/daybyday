/**
 * T2.1.2 — Port of knowledge.js normalizeKnowledgeRow_ + canonicalizeTopic_ to TypeScript.
 *
 * Column candidate resolution mirrors the GS "first match wins" strategy so that any
 * historical column-name variant (e.g. "summary", "min_age_days") normalises to the
 * canonical DB column without data loss.
 */

export type DbCategory =
  | "sleep"
  | "feeding"
  | "development"
  | "learning_play"
  | "emotional"
  | "behavior"
  | "safety";

export interface ContentItemInsert {
  tip_id: string;
  category: DbCategory;
  subcategory: string | null;
  age_min_days: number;
  age_max_days: number;
  stage: string | null;
  developmental_leap_phase: string | null;
  insight: string;
  action_tip: string;
  reassurance: string;
  sms_tip: string | null;
  follow_up_prompt: string | null;
  common_misunderstanding: string | null;
  signs_of_healthy_development: string | null;
  when_to_consult_doctor: string | null;
  development_focus: string | null;
  keywords: string[];
  difficulty_level: "easy" | "medium" | "hard";
  rotation_group: string | null;
  priority_weight: number;
  cooldown_days: number;
  message_type: string;
  milestone_key: string | null;
  checkin_question: string | null;
  reply_options: string | null;
  youtube_resource_title: string | null;
  youtube_resource_link: string | null;
  book_resource: string | null;
  research_reference: string | null;
  active: boolean;
}

/** Port of cleanText: String(value).trim() */
function clean(value: unknown): string {
  return String(value ?? "").trim();
}

/** Port of parseBoolean with a default */
function parseBool(value: unknown, defaultValue: boolean): boolean {
  if (value === true || value === false) return value;
  const text = clean(value).toLowerCase();
  if (text === "true" || text === "yes" || text === "1") return true;
  if (text === "false" || text === "no" || text === "0") return false;
  return defaultValue;
}

/** Port of getKnowledgeCell_: returns the first matching candidate or empty string. */
export function getCell(
  headers: string[],
  row: string[],
  candidates: string[],
): string {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return clean(row[idx]);
  }
  return "";
}

/**
 * Maps a raw sheet category to one of the 7 DB enum categories.
 *
 * The Knowledge sheet uses ~130 distinct category strings — bare developmental
 * domains ("motor", "social", "language"), product topics ("screen time",
 * "friendships"), and compounds ("sleep / safety", "feeding_attachment"). The
 * 7-value enum (sleep/feeding/development/learning_play/emotional/behavior/safety)
 * is fixed, so we group by developmental domain:
 *   - motor / sensory / physical / milestones      -> development
 *   - language / literacy / reading / play / cognitive -> learning_play
 *   - social / attachment / regulation / anxiety / parent support -> emotional
 *   - tantrums / discipline / screen time           -> behavior
 *
 * Compounds resolve on their primary (first) token, e.g. "sleep / safety" -> sleep.
 */
export function canonicalizeCategory(raw: string): DbCategory {
  let n = clean(raw).toLowerCase();
  if (!n) return "development";

  // Compounds: use the primary token ("sleep / safety" -> "sleep").
  if (n.includes("/")) n = (n.split("/")[0] ?? "").trim();
  // Normalize underscores so "feeding_attachment" matches like "feeding attachment".
  n = n.replace(/_/g, " ").trim();
  if (!n) return "development";

  // Exact canonical names first.
  if (n === "sleep") return "sleep";
  if (n === "feeding") return "feeding";
  if (n === "behavior") return "behavior";
  if (n === "safety") return "safety";
  if (n === "emotional") return "emotional";
  if (n === "development") return "development";
  if (n === "learning play" || n === "learning and play") return "learning_play";

  const has = (...words: string[]): boolean => words.some((w) => n.includes(w));

  // Order matters: safety and sleep win over more generic domains.
  if (has("safety", "choking", "burn")) return "safety";
  if (has("sleep")) return "sleep";
  if (has("feeding", "solid", "allergen", "picky", "swallow", "satiety", "eating", "nursing", "breastfeed", "bottle")) {
    return "feeding";
  }
  if (has("tantrum", "discipline", "aggression", "behavior", "frustration", "screen time", "chore", "defian", "routine")) {
    return "behavior";
  }
  if (has("language", "literacy", "reading", "story", "play", "cognitive", "montessori", "imagination", "music", "executive", "attention", "school readiness", "learning")) {
    return "learning_play";
  }
  if (has("motor", "sensory", "physical", "mobility", "milestone")) return "development";
  if (has("emotional", "attachment", "regulation", "crying", "anxiety", "separation", "resilience", "confidence", "mental health", "stress", "stranger", "identity", "social", "friend", "peer", "belonging", "autonomy", "independence", "parent", "caregiver", "wellbeing", "soothing", "voice", "smil", "bonding", "co-regulation")) {
    return "emotional";
  }

  return "development";
}

/** Port of buildFallbackTipId_ */
export function buildFallbackTipId(
  ageMin: number,
  ageMax: number,
  rawTopic: string,
  rowIndex: number,
): string {
  return `knowledge_${ageMin}_${ageMax}_${canonicalizeCategory(rawTopic)}_${rowIndex}`;
}

function normalizeStage(raw: string | undefined): string | null {
  return raw && raw.trim() ? raw.trim() : null;
}

function normalizeKeywords(raw: string): string[] {
  if (!raw) return [];
  // Sheet uses pipe-delimited keywords ("sleep|infant|safety"); also accept commas.
  return raw
    .split(/[,|]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function normalizeDifficulty(raw: string): "easy" | "medium" | "hard" {
  const v = clean(raw).toLowerCase();
  if (v === "medium") return "medium";
  if (v === "hard") return "hard";
  return "easy";
}

function nullIfEmpty(value: string): string | null {
  return value || null;
}

/**
 * Port of normalizeKnowledgeRow_ — converts a raw CSV header+row pair into a
 * ContentItemInsert ready for Supabase upsert.
 *
 * Returns null when the row cannot produce a valid tip_id or is missing required fields.
 *
 * Headers must already be lower-cased + trimmed (mirrors the GS `headers.map(cleanText)`).
 */
export function normalizeRow(
  headers: string[],
  row: string[],
  rowIndex: number,
): ContentItemInsert | null {
  const ageMin = Number(
    getCell(headers, row, ["child_age_days_min", "age_min_days", "min_age_days"]) || 0,
  );
  const ageMax = Number(
    getCell(headers, row, ["child_age_days_max", "age_max_days", "max_age_days"]) || 99999,
  );

  if (ageMin > ageMax) return null;

  const rawCategory = getCell(headers, row, ["category", "topic"]);
  const category = canonicalizeCategory(rawCategory);

  const insight = clean(
    getCell(headers, row, ["insight_explanation", "insight", "summary"]),
  );
  const actionTip = clean(
    getCell(headers, row, ["action_tip", "action", "tip", "sms_tip"]),
  );
  const reassurance = clean(
    getCell(headers, row, ["parent_reassurance", "encouragement", "reassurance"]),
  );

  if (!insight || !actionTip || !reassurance) return null;

  // Prefer an explicit tip_id, then the unique `id` column (stable across re-imports
  // and reorders), then a synthesized fallback. Separate getCell calls because
  // getCell returns the first *present header* even when its value is empty.
  const tipId =
    clean(getCell(headers, row, ["tip_id"])) ||
    clean(getCell(headers, row, ["id"])) ||
    buildFallbackTipId(ageMin, ageMax, rawCategory, rowIndex);

  if (!tipId) return null;

  const rawStage = getCell(headers, row, ["child_age_stage", "stage"]);
  const smsTip = clean(getCell(headers, row, ["sms_tip"])) || actionTip;
  const activeRaw = getCell(headers, row, ["active"]);

  return {
    tip_id: tipId,
    category,
    subcategory: nullIfEmpty(clean(getCell(headers, row, ["subcategory"]))),
    age_min_days: ageMin,
    age_max_days: ageMax,
    stage: normalizeStage(rawStage),
    developmental_leap_phase: nullIfEmpty(
      clean(getCell(headers, row, ["developmental_leap_phase"])),
    ),
    insight,
    action_tip: actionTip,
    reassurance,
    sms_tip: nullIfEmpty(smsTip !== actionTip ? smsTip : ""),
    follow_up_prompt: nullIfEmpty(
      clean(getCell(headers, row, ["follow_up_prompt", "parent_question"])),
    ),
    common_misunderstanding: nullIfEmpty(
      clean(getCell(headers, row, ["common_parent_misunderstanding", "common_misunderstanding"])),
    ),
    signs_of_healthy_development: nullIfEmpty(
      clean(getCell(headers, row, ["signs_of_healthy_development"])),
    ),
    when_to_consult_doctor: nullIfEmpty(
      clean(getCell(headers, row, ["when_to_consult_doctor"])),
    ),
    development_focus: nullIfEmpty(
      clean(getCell(headers, row, ["development_focus"])),
    ),
    keywords: normalizeKeywords(
      getCell(headers, row, ["keywords", "development_focus"]),
    ),
    difficulty_level: normalizeDifficulty(getCell(headers, row, ["difficulty_level"])),
    rotation_group:
      nullIfEmpty(clean(getCell(headers, row, ["rotation_group"]))) ?? category,
    priority_weight: Number(getCell(headers, row, ["priority_weight"]) || 1),
    cooldown_days: Number(getCell(headers, row, ["cooldown_days"]) || 21),
    message_type: clean(getCell(headers, row, ["message_type"])) || "daily",
    milestone_key: nullIfEmpty(clean(getCell(headers, row, ["milestone_key"]))),
    checkin_question: nullIfEmpty(clean(getCell(headers, row, ["checkin_question"]))),
    reply_options: nullIfEmpty(clean(getCell(headers, row, ["reply_options"]))),
    youtube_resource_title: nullIfEmpty(
      clean(getCell(headers, row, ["youtube_resource_title"])),
    ),
    youtube_resource_link: nullIfEmpty(
      clean(getCell(headers, row, ["youtube_resource_link"])),
    ),
    book_resource: nullIfEmpty(clean(getCell(headers, row, ["book_resource"]))),
    research_reference: nullIfEmpty(clean(getCell(headers, row, ["research_reference"]))),
    active: activeRaw === "" ? true : parseBool(activeRaw, true),
  };
}
