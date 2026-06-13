import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import type { AppConfig } from "./config.js";

const testConfig: AppConfig = {
  port: 0,
  nodeEnv: "test",
  publicBaseUrl: "https://api.daybyday.test",
  twilio: { authToken: "secret", accountSid: "AC", phoneNumber: "+1", validate: true },
  supabase: { url: "https://x.supabase.co", anonKey: "anon", serviceRoleKey: "svc" },
  vapid: { publicKey: "", privateKey: "", subject: "mailto:test@daybyday.test" },
  cronSecret: "test-secret",
};

describe("API app", () => {
  it("GET /health returns ok", async () => {
    const app = buildApp(testConfig);
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", service: "daybyday-api" });
    await app.close();
  });

  it("rejects an unsigned SMS webhook with 403", async () => {
    const app = buildApp(testConfig);
    const res = await app.inject({
      method: "POST",
      url: "/v1/webhooks/sms",
      payload: { From: "+15555550123", Body: "hi" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("allows the SMS webhook when validation is disabled (kill-switch)", async () => {
    const app = buildApp({ ...testConfig, twilio: { ...testConfig.twilio, validate: false } });
    const res = await app.inject({
      method: "POST",
      url: "/v1/webhooks/sms",
      payload: { From: "+15555550123", Body: "hi" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
