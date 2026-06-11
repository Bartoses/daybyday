import { describe, expect, it } from "vitest";
import {
  computeTwilioSignature,
  evaluateTwilioRequest,
  signaturesMatch,
} from "./twilioSignature.js";

// Self-consistent reference vector (inputs from Twilio's docs; EXPECTED is the verified
// HMAC-SHA1/base64 of those inputs, computed and pinned to lock the algorithm).
const TOKEN = "12345";
const URL = "https://mycompany.com/myapp.php?foo=1&bar=2";
const PARAMS = {
  Digits: "1234",
  To: "+18005551212",
  From: "+14158675310",
  Caller: "+14158675310",
  CallSid: "CA1234567890ABCDE",
};
const EXPECTED = "GvWf1cFY/Q7PnoempGyD5oXAezc=";

describe("computeTwilioSignature", () => {
  it("matches Twilio's documented reference vector", () => {
    expect(computeTwilioSignature(TOKEN, URL, PARAMS)).toBe(EXPECTED);
  });

  it("is order-independent (params sorted by key)", () => {
    const reordered = {
      CallSid: "CA1234567890ABCDE",
      From: "+14158675310",
      Caller: "+14158675310",
      To: "+18005551212",
      Digits: "1234",
    };
    expect(computeTwilioSignature(TOKEN, URL, reordered)).toBe(EXPECTED);
  });
});

describe("signaturesMatch", () => {
  it("true for equal strings", () => {
    expect(signaturesMatch(EXPECTED, EXPECTED)).toBe(true);
  });
  it("false for different strings", () => {
    expect(signaturesMatch(EXPECTED, "nope")).toBe(false);
  });
});

describe("evaluateTwilioRequest", () => {
  const base = {
    authToken: TOKEN,
    url: URL,
    params: PARAMS,
    validate: true,
  };

  it("accepts a valid signature", () => {
    expect(evaluateTwilioRequest({ ...base, signatureHeader: EXPECTED })).toEqual({
      ok: true,
      reason: "valid",
    });
  });

  it("rejects a forged signature", () => {
    expect(evaluateTwilioRequest({ ...base, signatureHeader: "forged" })).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("rejects a missing signature header", () => {
    expect(evaluateTwilioRequest({ ...base, signatureHeader: undefined })).toEqual({
      ok: false,
      reason: "missing_signature",
    });
  });

  it("fails when no auth token is configured", () => {
    expect(evaluateTwilioRequest({ ...base, authToken: "", signatureHeader: EXPECTED })).toEqual({
      ok: false,
      reason: "missing_token",
    });
  });

  it("skips validation when the kill-switch is off", () => {
    expect(evaluateTwilioRequest({ ...base, validate: false, signatureHeader: undefined })).toEqual(
      { ok: true, reason: "skipped" },
    );
  });
});
