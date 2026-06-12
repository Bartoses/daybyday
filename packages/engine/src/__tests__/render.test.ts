import { describe, expect, it } from "vitest";
import {
  renderCard,
  shortenAtSentenceBoundary,
  splitSms,
  MAX_SMS_PART_LENGTH,
  type RenderableContent,
} from "../render.js";
import type { Candidate } from "../score.js";

function makeContent(overrides: Partial<RenderableContent> = {}): RenderableContent {
  const base: Candidate = {
    tip_id: "tip_a",
    category: "sleep",
    rotation_group: null,
    stage: "newborn",
    age_min_days: 0,
    age_max_days: 56,
    priority_weight: 1,
    cooldown_days: 21,
    difficulty_level: "easy",
    active: true,
  };
  return {
    ...base,
    insight: "Babies sleep in short cycles.",
    action_tip: "Try a calm, consistent bedtime routine each night.",
    reassurance: "You are doing a wonderful job.",
    ...overrides,
  };
}

describe("shortenAtSentenceBoundary", () => {
  it("returns the text unchanged when within the limit", () => {
    expect(shortenAtSentenceBoundary("Short text.", 100)).toBe("Short text.");
  });

  it("adds terminal punctuation when missing", () => {
    expect(shortenAtSentenceBoundary("No period here", 100)).toBe("No period here.");
  });

  it("truncates at a sentence boundary", () => {
    const text = "First sentence here. Second sentence here. Third sentence here.";
    const result = shortenAtSentenceBoundary(text, 25);
    expect(result).toBe("First sentence here.");
  });

  it("falls back to word boundary when no sentence fits", () => {
    const text = "Averylongfirstpart and then some more words here";
    const result = shortenAtSentenceBoundary(text, 20);
    expect(result.length).toBeLessThanOrEqual(21); // +1 for added period
    expect(result.endsWith(".")).toBe(true);
  });
});

describe("renderCard", () => {
  it("produces full + SMS variants", () => {
    const card = renderCard(makeContent());
    expect(card.tip_id).toBe("tip_a");
    expect(card.insight).toBe("Babies sleep in short cycles.");
    expect(card.action_tip).toBe("Try a calm, consistent bedtime routine each night.");
    expect(card.sms.insight.length).toBeLessThanOrEqual(card.insight.length + 1);
  });

  it("strips a leading 'Try this today:' label from the action", () => {
    const card = renderCard(makeContent({ action_tip: "Try this today: do tummy time." }));
    expect(card.action_tip).toBe("do tummy time.");
  });

  it("strips a leading 'Try this:' label too", () => {
    const card = renderCard(makeContent({ action_tip: "Try this: read a book." }));
    expect(card.action_tip).toBe("read a book.");
  });
});

describe("splitSms", () => {
  it("returns a single part for short messages", () => {
    expect(splitSms("Hello world.")).toEqual(["Hello world."]);
  });

  it("returns empty array for empty input", () => {
    expect(splitSms("")).toEqual([]);
  });

  it("splits long messages into labeled Part x/n chunks", () => {
    const sentence = "This is a sentence that repeats. ";
    const long = sentence.repeat(60); // ~1980 chars > 1200
    const parts = splitSms(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toMatch(/^Part 1\/\d+\n\n/);
    expect(parts[parts.length - 1]).toMatch(/^Part \d+\/\d+\n\n/);
  });

  it("keeps each part within the max length", () => {
    const long = "Sentence number here. ".repeat(100);
    const parts = splitSms(long);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(MAX_SMS_PART_LENGTH);
    }
  });
});
