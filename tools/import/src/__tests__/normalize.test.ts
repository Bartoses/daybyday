import { describe, expect, it } from "vitest";
import {
  canonicalizeCategory,
  buildFallbackTipId,
  getCell,
  normalizeRow,
  type ContentItemInsert,
} from "../normalize.js";

// ---------------------------------------------------------------------------
// canonicalizeCategory — T2.1.2 AC: "category canonicalization matches knowledge.js table"
// ---------------------------------------------------------------------------
describe("canonicalizeCategory", () => {
  const cases: Array<[string, string]> = [
    // Sleep
    ["sleep", "sleep"],
    ["Sleep", "sleep"],
    ["sleep tip", "sleep"],
    // Feeding
    ["feeding", "feeding"],
    ["feeding tip", "feeding"],
    // Development variants
    ["development", "development"],
    ["development tip", "development"],
    ["motor development", "development"],
    ["motor", "development"],
    ["language development", "development"],
    ["speech development", "development"],
    ["cognitive development", "development"],
    // learning_play variants (GS returned "learning/play", DB uses "learning_play")
    ["learning/play", "learning_play"],
    ["learning_play", "learning_play"],
    ["learning", "learning_play"],
    ["language", "learning_play"],
    ["play", "learning_play"],
    ["learning and play", "learning_play"],
    ["montessori activities", "learning_play"],
    ["sensory play", "learning_play"],
    // emotional variants (GS returned "emotional development", DB uses "emotional")
    ["emotional development", "emotional"],
    ["emotional", "emotional"],
    ["parent emotional support", "emotional"],
    ["attachment and bonding", "emotional"],
    ["social development", "emotional"],
    // behavior
    ["behavior", "behavior"],
    // safety
    ["safety", "safety"],
    // fallback aliases
    ["today's next step", "development"],
    ["general", "development"],
    // empty → default
    ["", "development"],
    // unknown → default
    ["something else entirely", "development"],
  ];

  it.each(cases)('"%s" → "%s"', (input, expected) => {
    expect(canonicalizeCategory(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// buildFallbackTipId — mirrors GS buildFallbackTipId_
// ---------------------------------------------------------------------------
describe("buildFallbackTipId", () => {
  it("builds a stable ID from age + category + row index", () => {
    expect(buildFallbackTipId(0, 56, "sleep", 3)).toBe("knowledge_0_56_sleep_3");
  });

  it("canonicalizes the raw topic before embedding it", () => {
    expect(buildFallbackTipId(57, 120, "learning/play", 7)).toBe(
      "knowledge_57_120_learning_play_7",
    );
  });
});

// ---------------------------------------------------------------------------
// getCell — candidate-name fallback (T2.1.2 AC: each alias path)
// ---------------------------------------------------------------------------
describe("getCell", () => {
  const headers = ["age_min_days", "summary", "tip", "encouragement", "min_age_days"];
  const row = ["30", "Insight text", "Action text", "Reassurance text", "25"];

  it("returns first matching candidate (age_min_days before min_age_days)", () => {
    expect(getCell(headers, row, ["child_age_days_min", "age_min_days", "min_age_days"])).toBe(
      "30",
    );
  });

  it("falls back to min_age_days when primary candidates are absent", () => {
    const h = ["min_age_days"];
    const r = ["10"];
    expect(getCell(h, r, ["child_age_days_min", "age_min_days", "min_age_days"])).toBe("10");
  });

  it("summary → insight alias", () => {
    expect(getCell(headers, row, ["insight_explanation", "insight", "summary"])).toBe(
      "Insight text",
    );
  });

  it("tip → action_tip alias", () => {
    expect(getCell(headers, row, ["action_tip", "action", "tip", "sms_tip"])).toBe("Action text");
  });

  it("encouragement → reassurance alias", () => {
    expect(getCell(headers, row, ["parent_reassurance", "encouragement", "reassurance"])).toBe(
      "Reassurance text",
    );
  });

  it("returns empty string when no candidate found", () => {
    expect(getCell(headers, row, ["nonexistent_field"])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeRow — full row normalization (T2.1.2 AC)
// ---------------------------------------------------------------------------
describe("normalizeRow", () => {
  function makeRow(overrides: Record<string, string> = {}): {
    headers: string[];
    row: string[];
  } {
    const data: Record<string, string> = {
      tip_id: "tip_001",
      category: "sleep",
      age_min_days: "0",
      age_max_days: "56",
      insight_explanation: "Good sleep habits start early.",
      action_tip: "Try a consistent bedtime routine.",
      parent_reassurance: "You are doing great.",
      ...overrides,
    };
    return { headers: Object.keys(data), row: Object.values(data) };
  }

  it("normalizes a well-formed row", () => {
    const { headers, row } = makeRow();
    const result = normalizeRow(headers, row, 1);
    expect(result).not.toBeNull();
    const r = result as ContentItemInsert;
    expect(r.tip_id).toBe("tip_001");
    expect(r.category).toBe("sleep");
    expect(r.age_min_days).toBe(0);
    expect(r.age_max_days).toBe(56);
    expect(r.insight).toBe("Good sleep habits start early.");
    expect(r.action_tip).toBe("Try a consistent bedtime routine.");
    expect(r.reassurance).toBe("You are doing great.");
    expect(r.difficulty_level).toBe("easy");
    expect(r.cooldown_days).toBe(21);
    expect(r.active).toBe(true);
  });

  it("uses alias columns: summary→insight, tip→action_tip, encouragement→reassurance", () => {
    const data: Record<string, string> = {
      tip_id: "tip_002",
      category: "development",
      age_min_days: "30",
      age_max_days: "60",
      summary: "Summary as insight.",
      tip: "Tip as action.",
      encouragement: "Encouragement as reassurance.",
    };
    const result = normalizeRow(Object.keys(data), Object.values(data), 2);
    expect(result).not.toBeNull();
    const r = result as ContentItemInsert;
    expect(r.insight).toBe("Summary as insight.");
    expect(r.action_tip).toBe("Tip as action.");
    expect(r.reassurance).toBe("Encouragement as reassurance.");
  });

  it("uses min_age_days alias for age_min_days", () => {
    const data: Record<string, string> = {
      tip_id: "tip_003",
      category: "feeding",
      min_age_days: "10",
      max_age_days: "90",
      insight_explanation: "i",
      action_tip: "a",
      parent_reassurance: "r",
    };
    const result = normalizeRow(Object.keys(data), Object.values(data), 3);
    expect(result?.age_min_days).toBe(10);
    expect(result?.age_max_days).toBe(90);
  });

  it("synthesises a fallback tip_id when tip_id column is empty", () => {
    const { headers, row } = makeRow({ tip_id: "" });
    const result = normalizeRow(headers, row, 5);
    expect(result?.tip_id).toBe("knowledge_0_56_sleep_5");
  });

  it("returns null when insight is missing", () => {
    const { headers, row } = makeRow({ insight_explanation: "" });
    expect(normalizeRow(headers, row, 1)).toBeNull();
  });

  it("returns null when action_tip is missing", () => {
    const { headers, row } = makeRow({ action_tip: "" });
    expect(normalizeRow(headers, row, 1)).toBeNull();
  });

  it("returns null when reassurance is missing", () => {
    const { headers, row } = makeRow({ parent_reassurance: "" });
    expect(normalizeRow(headers, row, 1)).toBeNull();
  });

  it("returns null when age_min > age_max", () => {
    const { headers, row } = makeRow({ age_min_days: "100", age_max_days: "50" });
    expect(normalizeRow(headers, row, 1)).toBeNull();
  });

  it("parses active=false correctly", () => {
    const { headers, row } = makeRow({ active: "false" });
    expect(normalizeRow(headers, row, 1)?.active).toBe(false);
  });

  it("parses active=1 as true", () => {
    const { headers, row } = makeRow({ active: "1" });
    expect(normalizeRow(headers, row, 1)?.active).toBe(true);
  });

  it("splits keywords string into array", () => {
    const { headers, row } = makeRow({ keywords: "sleep, routine, newborn" });
    expect(normalizeRow(headers, row, 1)?.keywords).toEqual([
      "sleep",
      "routine",
      "newborn",
    ]);
  });

  it("maps difficulty_level=medium correctly", () => {
    const { headers, row } = makeRow({ difficulty_level: "medium" });
    expect(normalizeRow(headers, row, 1)?.difficulty_level).toBe("medium");
  });

  it("defaults difficulty_level to easy for unknown values", () => {
    const { headers, row } = makeRow({ difficulty_level: "unknown" });
    expect(normalizeRow(headers, row, 1)?.difficulty_level).toBe("easy");
  });

  it("maps learning/play category to learning_play", () => {
    const { headers, row } = makeRow({ category: "learning/play" });
    expect(normalizeRow(headers, row, 1)?.category).toBe("learning_play");
  });

  it("maps emotional development to emotional", () => {
    const { headers, row } = makeRow({ category: "emotional development" });
    expect(normalizeRow(headers, row, 1)?.category).toBe("emotional");
  });

  it("ignores __masked__ headers (unused columns)", () => {
    const data: Record<string, string> = {
      tip_id: "tip_masked",
      category: "behavior",
      age_min_days: "0",
      age_max_days: "365",
      insight_explanation: "i",
      action_tip: "a",
      parent_reassurance: "r",
      "__masked____unused__old_col": "should be ignored",
    };
    const result = normalizeRow(Object.keys(data), Object.values(data), 1);
    expect(result?.tip_id).toBe("tip_masked");
  });
});
