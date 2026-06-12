import { describe, expect, it } from "vitest";
import { leapContextForAge, LEAP_WINDOWS } from "../leap.js";

describe("leapContextForAge", () => {
  it("detects an active leap window (leap 1: 35-55 days)", () => {
    const ctx = leapContextForAge(40);
    expect(ctx.inLeapWindow).toBe(true);
    expect(ctx.leap?.leapNumber).toBe(1);
  });

  it("reports no window outside any leap range", () => {
    const ctx = leapContextForAge(300); // past leap 6 (ends 305) ... actually inside
    // 300 is within leap 6 (240-305); use a clear gap instead:
    const gap = leapContextForAge(170); // between leap 4 (ends 168) and leap 5 (starts 180)
    expect(gap.inLeapWindow).toBe(false);
    expect(gap.leap).toBeNull();
    // sanity on the original to avoid an unused var
    expect(ctx.inLeapWindow).toBe(true);
  });

  it("uses adjusted age (corrected for prematurity) when provided", () => {
    // Chronologically 50d (in leap 1), but corrected to 10d (no window).
    const ctx = leapContextForAge(50, 10);
    expect(ctx.leapAgeDays).toBe(10);
    expect(ctx.inLeapWindow).toBe(false);
    expect(ctx.leapConfidence).toBe("higher");
  });

  it("flags lower confidence when no adjusted age is available", () => {
    expect(leapContextForAge(40).leapConfidence).toBe("lower");
  });

  it("windows are ordered and non-overlapping", () => {
    for (let i = 1; i < LEAP_WINDOWS.length; i++) {
      expect(LEAP_WINDOWS[i]!.ageDaysStart).toBeGreaterThan(LEAP_WINDOWS[i - 1]!.ageDaysEnd);
    }
  });
});
