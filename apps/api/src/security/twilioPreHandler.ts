import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { evaluateTwilioRequest } from "./twilioSignature.js";

/**
 * Fastify preHandler that rejects forged Twilio webhooks with 403 before any work.
 * Reconstructs the signed URL from PUBLIC_BASE_URL + the original path (proxy-safe).
 */
export function makeTwilioPreHandler(config: AppConfig) {
  return async function twilioPreHandler(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.body ?? {}) as Record<string, string>;
    const url = `${config.publicBaseUrl}${req.url}`;
    const signatureHeader = req.headers["x-twilio-signature"];

    const verdict = evaluateTwilioRequest({
      authToken: config.twilio.authToken,
      url,
      params,
      signatureHeader: Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader,
      validate: config.twilio.validate,
    });

    if (!verdict.ok) {
      req.log.warn({ reason: verdict.reason }, "Rejected Twilio webhook");
      // Empty TwiML so Twilio doesn't retry against a forged-but-rejected request.
      return reply.code(403).type("text/xml").send("<Response></Response>");
    }
  };
}
