import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio request signature validation (fixes audit R1: the legacy webhook was
 * ANYONE_ANONYMOUS with no signature check).
 *
 * Algorithm (per Twilio's spec):
 *   1. Take the full request URL.
 *   2. If the body is form-urlencoded, append each POST param sorted alphabetically
 *      by key, concatenating key + value (no separators).
 *   3. HMAC-SHA1 the resulting string with the auth token as the key.
 *   4. Base64-encode and compare (constant-time) to the X-Twilio-Signature header.
 *
 * All functions here are pure and unit-tested — no I/O, no framework coupling.
 */

export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  let data = url;
  for (const key of Object.keys(params).sort()) {
    data += key + params[key];
  }
  return createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

export function signaturesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(actual, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface TwilioRequestInput {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signatureHeader: string | undefined;
  /** When false (ops kill-switch) or in TEST_MODE, validation is skipped. */
  validate: boolean;
}

export interface TwilioRequestVerdict {
  ok: boolean;
  reason: "valid" | "skipped" | "missing_signature" | "missing_token" | "mismatch";
}

/** Pure decision function — the framework middleware is a thin wrapper around this. */
export function evaluateTwilioRequest(input: TwilioRequestInput): TwilioRequestVerdict {
  if (!input.validate) return { ok: true, reason: "skipped" };
  if (!input.authToken) return { ok: false, reason: "missing_token" };
  if (!input.signatureHeader) return { ok: false, reason: "missing_signature" };

  const expected = computeTwilioSignature(input.authToken, input.url, input.params);
  if (!signaturesMatch(expected, input.signatureHeader)) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true, reason: "valid" };
}
