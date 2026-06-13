import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

let configured = false;

/** Configure web-push with VAPID details once. Returns false if keys are missing. */
export function ensureVapid(config: AppConfig): boolean {
  if (configured) return true;
  const { publicKey, privateKey, subject } = config.vapid;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send a push to all of a parent's subscriptions. Prunes subscriptions the push
 * service reports as gone (404/410). Returns how many were delivered.
 */
export async function sendToParent(
  db: SupabaseClient,
  config: AppConfig,
  parentId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!ensureVapid(config)) return { sent: 0, pruned: 0 };

  const { data } = await db
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("parent_id", parentId);

  const subs = (data ?? []) as SubRow[];
  let sent = 0;
  let pruned = 0;
  const message = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("web_push_subscriptions").delete().eq("id", s.id);
          pruned += 1;
        }
      }
    }),
  );

  return { sent, pruned };
}
