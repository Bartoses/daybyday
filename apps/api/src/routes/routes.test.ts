import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AppConfig } from "../config.js";

const testConfig: AppConfig = {
  port: 0,
  nodeEnv: "test",
  publicBaseUrl: "https://api.daybyday.test",
  twilio: { authToken: "secret", accountSid: "AC", phoneNumber: "+1", validate: true },
  supabase: { url: "https://x.supabase.co", anonKey: "anon", serviceRoleKey: "svc" },
  vapid: { publicKey: "", privateKey: "", subject: "mailto:test@daybyday.test" },
  cronSecret: "test-secret",
  adminEmail: "admin@daybyday.test",
  day: { apiKey: "", model: "claude-sonnet-4-6", freeDailyLimit: 10 },
  email: { apiKey: "", from: "DaybyDay <test@daybyday.test>", appUrl: "https://app.test" },
};

/**
 * Verifies EPIC 4 routes are registered and gated by auth. These don't touch the
 * DB — an unauthenticated request must be rejected before any Supabase call.
 */
describe("EPIC 4 routes are auth-gated", () => {
  const cases: Array<[string, string, object?]> = [
    ["GET", "/v1/me"],
    ["PATCH", "/v1/me", { name: "B" }],
    ["POST", "/v1/account/bootstrap", { name: "A" }],
    ["POST", "/v1/children", { name: "Kid", birthdate: "2026-01-01" }],
    ["PATCH", "/v1/children/00000000-0000-0000-0000-000000000000", { name: "X" }],
    ["DELETE", "/v1/children/00000000-0000-0000-0000-000000000000"],
    ["POST", "/v1/onboarding/complete"],
    ["GET", "/v1/feed/today?child_id=00000000-0000-0000-0000-000000000000"],
    [
      "POST",
      "/v1/feed/quick-action",
      { child_id: "00000000-0000-0000-0000-000000000000", request_type: "sleep" },
    ],
    [
      "POST",
      "/v1/feed/tip_123/feedback",
      { child_id: "00000000-0000-0000-0000-000000000000", helpful: true },
    ],
    ["GET", "/v1/faq?child_id=00000000-0000-0000-0000-000000000000"],
    [
      "POST",
      "/v1/questions",
      { child_id: "00000000-0000-0000-0000-000000000000", question: "why" },
    ],
    ["GET", "/v1/questions"],
    [
      "POST",
      "/v1/push/subscribe",
      { subscription: { endpoint: "x", keys: { p256dh: "a", auth: "b" } } },
    ],
    ["POST", "/v1/push/test"],
  ];

  it.each(cases)("%s %s -> 401 without a bearer token", async (method, url, payload) => {
    const app = buildApp(testConfig);
    const res = await app.inject({ method: method as "GET", url, payload });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
