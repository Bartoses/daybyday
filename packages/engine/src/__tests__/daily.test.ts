import { describe, expect, it } from "vitest";
import {
  DAILY_STAGES,
  dailyStageForAgeDays,
  selectDailyTip,
  type DailyTipCandidate,
} from "../daily.js";

function pool(n: number, priority = 1): DailyTipCandidate[] {
  return Array.from({ length: n }, (_, i) => ({ tip_id: `t${i}`, priority_weight: priority }));
}

describe("dailyStageForAgeDays", () => {
  it("maps ages to the right stage label", () => {
    expect(dailyStageForAgeDays(0)).toBe("0-1 month");
    expect(dailyStageForAgeDays(30)).toBe("0-1 month");
    expect(dailyStageForAgeDays(31)).toBe("1-3 months");
    expect(dailyStageForAgeDays(365)).toBe("9-12 months");
    expect(dailyStageForAgeDays(800)).toBe("2-3 years");
    expect(dailyStageForAgeDays(1500)).toBe("3-5 years"); // 5–6yr gap folds into 3-5 years
    expect(dailyStageForAgeDays(3650)).toBe("9-12 years");
  });

  it("clamps ages beyond the last band to the oldest stage", () => {
    expect(dailyStageForAgeDays(99999)).toBe("16-18 years");
    expect(dailyStageForAgeDays(-5)).toBe("0-1 month"); // negative clamps to 0
  });

  it("every band label is non-empty and ordered", () => {
    expect(DAILY_STAGES.length).toBe(13);
    expect(DAILY_STAGES.every((s) => s.label.length > 0)).toBe(true);
  });
});

describe("selectDailyTip", () => {
  it("returns null for an empty pool", () => {
    expect(selectDailyTip([], [], "seed")).toBeNull();
  });

  it("brand-new child: picks the highest-priority tip", () => {
    const candidates = [
      { tip_id: "a", priority_weight: 1 },
      { tip_id: "b", priority_weight: 5 },
      { tip_id: "c", priority_weight: 2 },
    ];
    expect(selectDailyTip(candidates, [], "seed")?.tip_id).toBe("b");
  });

  it("excludes the recent-window (last N=floor(0.7*pool) distinct tips)", () => {
    const candidates = pool(10); // N = 7
    // 7 most-recent distinct shown → only t7, t8, t9 remain eligible.
    const history = ["t0", "t1", "t2", "t3", "t4", "t5", "t6"];
    const pick = selectDailyTip(candidates, history, "seed");
    expect(["t7", "t8", "t9"]).toContain(pick?.tip_id);
  });

  it("prefers least-seen tips among the eligible set", () => {
    const candidates = pool(10); // N = 7
    // Recent window = t0..t6. Among eligible (t7,t8,t9), t8 shown more times long ago.
    const history = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t8", "t9", "t8", "t9", "t8"];
    // t7 has 0 shows; t8/t9 have more → least-seen first picks t7.
    expect(selectDailyTip(candidates, history, "seed")?.tip_id).toBe("t7");
  });

  it("guarantees a no-repeat gap of at least N picks (full-coverage sweep)", () => {
    const candidates = pool(10); // N = 7 → min gap 7
    const history: string[] = [];
    const seen: string[] = [];
    for (let day = 0; day < 30; day++) {
      const pick = selectDailyTip(candidates, history, `child:day${day}`);
      expect(pick).not.toBeNull();
      seen.push(pick!.tip_id);
      history.unshift(pick!.tip_id); // most-recent first
    }
    // No tip repeats within any window of N picks.
    for (let i = 0; i < seen.length; i++) {
      const window = seen.slice(Math.max(0, i - 7 + 1), i);
      expect(window).not.toContain(seen[i]);
    }
  });

  it("relaxes the window rather than hard-failing when everything is on cooldown", () => {
    const candidates = pool(3); // N = floor(0.7*3)=2
    // History covers all 3 recently; 0.7 window (2) leaves 1 eligible — still returns.
    const history = ["t0", "t1", "t2"];
    const pick = selectDailyTip(candidates, history, "seed");
    expect(pick).not.toBeNull();
  });

  it("is deterministic for the same seed and inputs", () => {
    const candidates = pool(20);
    const history = ["t0", "t1"];
    const a = selectDailyTip(candidates, history, "child:2026-06-14")?.tip_id;
    const b = selectDailyTip(candidates, history, "child:2026-06-14")?.tip_id;
    expect(a).toBe(b);
  });
});
