import { describe, expect, it } from "vitest";
import {
  scoreCandidate,
  selectContentItem,
  type Candidate,
  type HistoryEntry,
  type ScoreInput,
} from "../score.js";
import { leapContextForAge } from "../leap.js";

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
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
    ...overrides,
  };
}

function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    ageDays: 28,
    preferredCategory: "sleep",
    preferredStages: ["newborn"],
    history: [],
    leapContext: null,
    now: new Date("2026-06-12T00:00:00Z"),
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  it("base score is priority_weight * 10 plus novelty when never sent", () => {
    // priority 1*10 = 10, +novelty 15, +preferredTopic 18, +stage 20,
    // -ageMidpoint(|28-28|=0)=0, difficulty easy 0  => 63
    const c = makeCandidate();
    expect(scoreCandidate(c, makeInput())).toBe(63);
  });

  it("excludes a tip still within its cooldown window (returns null)", () => {
    const c = makeCandidate({ cooldown_days: 21 });
    const history: HistoryEntry[] = [
      { tip_id: "tip_a", sent_at: "2026-06-01T00:00:00Z", topic: "sleep", rotation_group: null },
    ];
    // 11 days since < 21 cooldown -> excluded
    expect(scoreCandidate(c, makeInput({ history }))).toBeNull();
  });

  it("applies repeat penalty (-25 instead of +15 novelty) once past cooldown", () => {
    const c = makeCandidate({ cooldown_days: 5 });
    const history: HistoryEntry[] = [
      { tip_id: "tip_a", sent_at: "2026-06-01T00:00:00Z", topic: "sleep", rotation_group: null },
    ];
    // 11 days since >= 5 cooldown. The same history row drives two separate
    // penalties (legacy two-loop behavior): repeat -25 AND category rotation -18.
    // 10 base -25 repeat +18 preferred +20 stage -0 age -18 category = 5
    expect(scoreCandidate(c, makeInput({ history }))).toBe(5);
  });

  it("adds stage boost only when target stage matches", () => {
    const withStage = scoreCandidate(makeCandidate({ stage: "newborn" }), makeInput())!;
    const wrongStage = scoreCandidate(makeCandidate({ stage: "preschooler" }), makeInput())!;
    expect(withStage - wrongStage).toBe(20);
  });

  it("adds preferred-topic boost for a category match", () => {
    const match = scoreCandidate(makeCandidate({ category: "sleep" }), makeInput())!;
    const noMatch = scoreCandidate(
      makeCandidate({ category: "feeding", stage: "newborn" }),
      makeInput({ preferredCategory: "sleep" }),
    )!;
    expect(match - noMatch).toBe(18);
  });

  it("treats behavior request as matching emotional content (alias)", () => {
    const c = makeCandidate({ category: "emotional", stage: "newborn" });
    const score = scoreCandidate(c, makeInput({ preferredCategory: "behavior" }))!;
    // 10 +15 novelty +18 alias +20 stage -0 = 63
    expect(score).toBe(63);
  });

  it("penalizes age-midpoint distance up to the cap of 40", () => {
    const near = scoreCandidate(
      makeCandidate({ age_min_days: 0, age_max_days: 56 }),
      makeInput({ ageDays: 28 }),
    )!; // midpoint 28, distance 0
    const far = scoreCandidate(
      makeCandidate({ age_min_days: 0, age_max_days: 56 }),
      makeInput({ ageDays: 28 + 100, preferredStages: ["newborn"] }),
    )!; // distance 100 -> capped at 40
    expect(near - far).toBe(40);
  });

  it("applies leap boost for sleep/emotional/behavior during a leap window", () => {
    const leap = leapContextForAge(40); // leap 1 window (35-55)
    const boosted = scoreCandidate(
      makeCandidate({ category: "sleep" }),
      makeInput({ ageDays: 40, leapContext: leap, preferredStages: ["newborn"] }),
    )!;
    const noLeap = scoreCandidate(
      makeCandidate({ category: "sleep" }),
      makeInput({ ageDays: 40, leapContext: null, preferredStages: ["newborn"] }),
    )!;
    expect(boosted - noLeap).toBe(25);
  });

  it("does NOT leap-boost categories outside the boost set", () => {
    const leap = leapContextForAge(40);
    const dev = scoreCandidate(
      makeCandidate({ category: "development", stage: "newborn" }),
      makeInput({ ageDays: 40, leapContext: leap, preferredCategory: "development" }),
    )!;
    const devNoLeap = scoreCandidate(
      makeCandidate({ category: "development", stage: "newborn" }),
      makeInput({ ageDays: 40, leapContext: null, preferredCategory: "development" }),
    )!;
    expect(dev - devNoLeap).toBe(0);
  });

  it("applies a time-of-day boost when category fits the hour (evening → sleep)", () => {
    const sleep = makeCandidate({ category: "sleep", stage: "newborn" });
    const evening = scoreCandidate(
      sleep,
      makeInput({ temporal: { hour: 20 }, preferredCategory: "sleep" }),
    )!;
    const noTemporal = scoreCandidate(
      sleep,
      makeInput({ temporal: null, preferredCategory: "sleep" }),
    )!;
    expect(evening - noTemporal).toBe(17);
  });

  it("does NOT time-boost a category that doesn't fit the hour (sleep at midday)", () => {
    const sleep = makeCandidate({ category: "sleep", stage: "newborn" });
    const midday = scoreCandidate(
      sleep,
      makeInput({ temporal: { hour: 13 }, preferredCategory: "sleep" }),
    )!;
    const noTemporal = scoreCandidate(
      sleep,
      makeInput({ temporal: null, preferredCategory: "sleep" }),
    )!;
    expect(midday - noTemporal).toBe(0);
  });

  it("morning boosts feeding; evening boosts sleep", () => {
    const feeding = makeCandidate({ category: "feeding", stage: "newborn" });
    const morningFeeding = scoreCandidate(
      feeding,
      makeInput({ temporal: { hour: 8 }, preferredCategory: "feeding" }),
    )!;
    const eveningFeeding = scoreCandidate(
      feeding,
      makeInput({ temporal: { hour: 20 }, preferredCategory: "feeding" }),
    )!;
    expect(morningFeeding).toBeGreaterThan(eveningFeeding); // feeding fits morning, not evening
  });

  it("applies difficulty penalties (easy 0, medium 4, hard 8)", () => {
    const easy = scoreCandidate(makeCandidate({ difficulty_level: "easy" }), makeInput())!;
    const medium = scoreCandidate(makeCandidate({ difficulty_level: "medium" }), makeInput())!;
    const hard = scoreCandidate(makeCandidate({ difficulty_level: "hard" }), makeInput())!;
    expect(easy - medium).toBe(4);
    expect(easy - hard).toBe(8);
  });

  it("applies decaying category + rotation-group penalties from history", () => {
    const c = makeCandidate({ category: "sleep", rotation_group: "sleep_group" });
    const history: HistoryEntry[] = [
      {
        tip_id: "other1",
        sent_at: "2026-05-01T00:00:00Z",
        topic: "sleep",
        rotation_group: "sleep_group",
      },
    ];
    const withHist = scoreCandidate(c, makeInput({ history }))!;
    const noHist = scoreCandidate(c, makeInput({ history: [] }))!;
    // i=0: -18/1 category -12/1 rotation = -30
    expect(noHist - withHist).toBe(30);
  });
});

describe("selectContentItem", () => {
  it("returns the highest-scoring candidate", () => {
    const candidates: Candidate[] = [
      makeCandidate({ tip_id: "low", priority_weight: 1, stage: "preschooler" }),
      makeCandidate({ tip_id: "high", priority_weight: 5, stage: "newborn" }),
    ];
    const chosen = selectContentItem(candidates, makeInput());
    expect(chosen?.tip_id).toBe("high");
  });

  it("prefers exact-age + preferred-category pool over broader pools", () => {
    const candidates: Candidate[] = [
      // exact age, preferred category sleep
      makeCandidate({
        tip_id: "exact_sleep",
        category: "sleep",
        age_min_days: 0,
        age_max_days: 56,
      }),
      // exact age, different category, higher raw score
      makeCandidate({
        tip_id: "exact_feeding",
        category: "feeding",
        priority_weight: 10,
        age_min_days: 0,
        age_max_days: 56,
      }),
    ];
    const chosen = selectContentItem(candidates, makeInput({ preferredCategory: "sleep" }));
    expect(chosen?.tip_id).toBe("exact_sleep");
  });

  it("falls back to near-age pool when no exact-age match exists", () => {
    const candidates: Candidate[] = [
      makeCandidate({ tip_id: "near", age_min_days: 60, age_max_days: 70 }),
    ];
    // ageDays 50: not in [60,70] exactly, but within 21-day window
    const chosen = selectContentItem(candidates, makeInput({ ageDays: 50, preferredStages: [] }));
    expect(chosen?.tip_id).toBe("near");
  });

  it("excludes inactive candidates", () => {
    const candidates: Candidate[] = [makeCandidate({ tip_id: "inactive", active: false })];
    expect(selectContentItem(candidates, makeInput())).toBeNull();
  });

  it("does not reselect a tip inside cooldown, picks a fresh one instead", () => {
    const candidates: Candidate[] = [
      makeCandidate({ tip_id: "cooling", cooldown_days: 21 }),
      makeCandidate({ tip_id: "fresh", priority_weight: 0.5 }),
    ];
    const history: HistoryEntry[] = [
      { tip_id: "cooling", sent_at: "2026-06-05T00:00:00Z", topic: "sleep", rotation_group: null },
    ];
    const chosen = selectContentItem(candidates, makeInput({ history }));
    expect(chosen?.tip_id).toBe("fresh");
  });

  it("is deterministic and tie-breaks by tip_id ascending", () => {
    const candidates: Candidate[] = [
      makeCandidate({ tip_id: "bbb" }),
      makeCandidate({ tip_id: "aaa" }),
    ];
    const chosen = selectContentItem(candidates, makeInput());
    expect(chosen?.tip_id).toBe("aaa");
  });

  it("returns null when nothing is age-eligible", () => {
    const candidates: Candidate[] = [
      makeCandidate({ tip_id: "toddler", age_min_days: 1000, age_max_days: 1100 }),
    ];
    expect(selectContentItem(candidates, makeInput({ ageDays: 10 }))).toBeNull();
  });
});
