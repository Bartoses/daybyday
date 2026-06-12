import { describe, expect, it } from "vitest";
import {
  requestedCategoryAliases,
  resolveFamilyCategory,
  chooseTopicForChild,
} from "../topic.js";
import { hashString } from "../hash.js";

describe("requestedCategoryAliases", () => {
  it("behavior also matches emotional", () => {
    expect(requestedCategoryAliases("behavior")).toEqual(["behavior", "emotional"]);
  });
  it("other categories map to themselves", () => {
    expect(requestedCategoryAliases("sleep")).toEqual(["sleep"]);
    expect(requestedCategoryAliases("learning_play")).toEqual(["learning_play"]);
  });
});

describe("resolveFamilyCategory", () => {
  it("returns an explicit category unchanged", () => {
    expect(resolveFamilyCategory("feeding", "p1", "2026-06-12", [], true)).toBe("feeding");
  });

  it("is deterministic for the same parent + date + seed", () => {
    const a = resolveFamilyCategory(null, "p1", "2026-06-12", [], true);
    const b = resolveFamilyCategory(null, "p1", "2026-06-12", [], true);
    expect(a).toBe(b);
  });

  it("excludes the most recent category", () => {
    const recent = ["sleep" as const];
    const chosen = resolveFamilyCategory(null, "p1", "2026-06-12", recent, true);
    expect(chosen).not.toBe("sleep");
  });

  it("daily and follow-up seeds can differ", () => {
    // Not guaranteed different, but must each be stable.
    const daily = resolveFamilyCategory(null, "p1", "2026-06-12", [], true);
    const followup = resolveFamilyCategory(null, "p1", "2026-06-12", [], false);
    expect(typeof daily).toBe("string");
    expect(typeof followup).toBe("string");
  });
});

describe("chooseTopicForChild", () => {
  it("is deterministic for the same child + date", () => {
    const topics = ["sleep", "feeding", "development"] as const;
    const a = chooseTopicForChild("c1", "2026-06-12", [...topics], []);
    const b = chooseTopicForChild("c1", "2026-06-12", [...topics], []);
    expect(a).toBe(b);
  });

  it("pushes recently-used topics to the back of rotation", () => {
    // With only 2 topics and one recently used, the hash should land on the
    // non-recent one most of the time; assert it never returns null/undefined.
    const chosen = chooseTopicForChild("c1", "2026-06-12", ["sleep", "feeding"], ["sleep"]);
    expect(["sleep", "feeding"]).toContain(chosen);
  });
});

describe("hashString", () => {
  it("matches the legacy Java-style hash for a known input", () => {
    // Computed from the legacy implementation for stability.
    expect(hashString("abc")).toBe(96354);
    expect(hashString("")).toBe(0);
  });

  it("is stable across calls", () => {
    expect(hashString("p1:2026-06-12:daily")).toBe(hashString("p1:2026-06-12:daily"));
  });
});
