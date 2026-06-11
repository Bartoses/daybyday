import { describe, expect, it } from "vitest";
import { STAGES } from "./enums.js";
import { ageDaysFromBirthdate, stageForAgeDays } from "./stage.js";

describe("stageForAgeDays", () => {
  // Boundary table must match Config.js APP_CONFIG.stages exactly (T1.2.3 AC).
  const cases: Array<[number, string]> = [
    [0, "newborn"],
    [56, "newborn"],
    [57, "early_baby"],
    [120, "early_baby"],
    [121, "growing_baby"],
    [210, "growing_baby"],
    [211, "exploring_baby"],
    [365, "exploring_baby"],
    [366, "new_toddler"],
    [540, "new_toddler"],
    [541, "curious_toddler"],
    [1095, "curious_toddler"],
    [1096, "preschooler"],
    [1825, "preschooler"],
    [1826, "early_school_age"],
    [3650, "early_school_age"],
  ];

  it.each(cases)("age %i days -> %s", (age, expected) => {
    expect(stageForAgeDays(age)).toBe(expected);
  });

  it("clamps ages beyond the last stage to early_school_age", () => {
    expect(stageForAgeDays(99999)).toBe("early_school_age");
  });

  it("returns null for pre-birth (negative) ages", () => {
    expect(stageForAgeDays(-10)).toBeNull();
  });

  it("STAGES form a continuous, non-overlapping range from day 0", () => {
    expect(STAGES[0]!.minAgeDays).toBe(0);
    for (let i = 1; i < STAGES.length; i++) {
      expect(STAGES[i]!.minAgeDays).toBe(STAGES[i - 1]!.maxAgeDays + 1);
    }
  });
});

describe("ageDaysFromBirthdate", () => {
  it("computes whole days between two dates", () => {
    expect(ageDaysFromBirthdate("2026-01-01", new Date("2026-01-31T12:00:00Z"))).toBe(30);
  });

  it("returns 0 on the birthday", () => {
    expect(ageDaysFromBirthdate("2026-06-11", new Date("2026-06-11T08:00:00Z"))).toBe(0);
  });

  it("is negative for a future birthdate", () => {
    expect(ageDaysFromBirthdate("2026-12-01", new Date("2026-06-11T00:00:00Z"))).toBeLessThan(0);
  });
});
