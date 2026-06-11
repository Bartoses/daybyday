import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { STAGES } from "@daybyday/schemas";

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "supabase", "seed.sql");
const seed = readFileSync(seedPath, "utf8");

describe("seed.sql stage parity", () => {
  // Every stage in the shared enum must appear in the seed with identical day ranges,
  // so the DB reference table can never drift from Config.js. (T1.2.3 AC)
  it.each(STAGES.map((s) => [s.key, s.minAgeDays, s.maxAgeDays] as const))(
    "seeds %s with %i..%i",
    (key, min, max) => {
      const line = seed.split("\n").find((l) => l.includes(`'${key}'`));
      expect(line, `seed line for ${key}`).toBeDefined();
      expect(line).toContain(`${min},`);
      expect(line).toContain(`${max},`);
    },
  );

  it("seeds all 7 canonical categories", () => {
    for (const cat of [
      "development",
      "sleep",
      "learning_play",
      "feeding",
      "behavior",
      "emotional",
      "safety",
    ]) {
      expect(seed).toContain(`'${cat}'`);
    }
  });

  it("seeds the 6 milestone prompts", () => {
    for (const key of [
      "first_smile",
      "first_roll",
      "first_crawl",
      "first_stand",
      "first_step",
      "first_word",
    ]) {
      expect(seed).toContain(`'${key}'`);
    }
  });
});
