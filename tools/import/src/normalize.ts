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
 * Port of canonicalizeTopic_ but maps directly to the DB enum.
 * The GS function returned "learning/play" and "emotional development"; we map those
 * to "learning_play" and "emotional" to satisfy the content_items check constraint.
 */
export function canonicalizeCategory(raw: string): DbCategory {
  const normalized = clean(raw).toLowerCase();

  if (!normalized) return "development";

  if (normalized === "sleep" || normalized === "sleep tip") return "sleep";

  if (normalized === "feeding" || normalized === "feeding tip") return "feeding";

  if (
    normalized === "development" ||
    normalized === "development tip" ||
    normalized === "motor development" ||
    normalized === "motor" ||
    normalized === "language development" ||
    normalized === "speech development" ||
    normalized === "cognitive development"
  ) {
    return "development";
  }

  if (
    normalized === "learning/play" ||
    normalized === "learning_play" ||
    normalized === "learning" ||
    normalized === "language" ||
    normalized === "play" ||
    normalized === "learning and play" ||
    normalized === "montessori activities" ||
    normalized === "sensory play"
  ) {
    return "learning_play";
  }

  if (
    normalized === "emotional development" ||
    normalized === "emotional" ||
    normalized === "parent emotional support" ||
    normalized === "attachment and bonding" ||
    normalized === "social development"
  ) {
    return "emotional";
  }

  if (normalized === "behavior") return "behavior";

  if (normalized === "safety") return "safety";

  if (normalized === "today's next step" || normalized === "general") {
    return "development";
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
  return raw
    .split(",")
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

  const tipId =
    clean(getCell(headers, row, ["tip_id"])) ||
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
