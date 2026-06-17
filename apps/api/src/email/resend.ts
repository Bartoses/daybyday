import type { AppConfig } from "../config.js";

/**
 * Send a transactional email via Resend's REST API (no SDK dependency).
 * Returns false (and never throws) when email isn't configured or the send fails,
 * so the weekly-digest cron degrades gracefully.
 */
export async function sendEmail(
  config: AppConfig,
  msg: { to: string; subject: string; html: string },
): Promise<boolean> {
  if (!config.email.apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.email.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
