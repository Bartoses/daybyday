import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hashString } from "@daybyday/engine";
import type { Category } from "@daybyday/schemas";
import { selectFeedCard, localHour, type ChildRow } from "../feed/service.js";
import { sendToParent, sendBroadcastToAll } from "../push/service.js";

interface ParentRow {
  id: string;
  name: string | null;
  timezone: string;
}
interface PrefRow {
  parent_id: string;
  daily_enabled: boolean;
  send_hour: number;
  categories: string[] | null;
}

/**
 * Internal cron endpoints (guarded by a shared secret). Triggered hourly by an
 * external scheduler (GitHub Actions). Sends each opted-in family their daily
 * tip at their chosen local hour, deduped to once per day.
 */
export async function cronRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/internal/cron/daily-push", async (req: FastifyRequest, reply: FastifyReply) => {
    const secret = req.headers["x-cron-secret"];
    if (!app.config.cronSecret || secret !== app.config.cronSecret) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Invalid cron secret" } });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Only consider parents who have at least one push subscription.
    const { data: subRows } = await app.db.from("web_push_subscriptions").select("parent_id");
    const parentIds = [...new Set((subRows ?? []).map((r) => (r as { parent_id: string }).parent_id))];

    const considered0 = parentIds.length === 0;
    const [{ data: parents }, { data: prefs }, { data: children }, { data: sentRows }] = considered0
      ? [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
      app.db.from("parents").select("id, name, timezone").in("id", parentIds),
      app.db.from("notification_prefs").select("parent_id, daily_enabled, send_hour, categories").in("parent_id", parentIds),
      app.db.from("children").select("id, parent_id, name, birthdate, due_date, created_at").in("parent_id", parentIds).order("created_at", { ascending: true }),
      app.db.from("messages").select("parent_id").eq("message_type", "daily_push").eq("send_date", today).in("parent_id", parentIds),
    ]);

    const prefsBy = new Map<string, PrefRow>((prefs ?? []).map((p) => [(p as PrefRow).parent_id, p as PrefRow]));
    const firstChild = new Map<string, ChildRow>();
    for (const c of (children ?? []) as Array<ChildRow & { parent_id: string }>) {
      if (!firstChild.has(c.parent_id)) firstChild.set(c.parent_id, c);
    }
    const alreadySent = new Set((sentRows ?? []).map((r) => (r as { parent_id: string }).parent_id));

    let considered = 0;
    let sent = 0;

    for (const p of (parents ?? []) as ParentRow[]) {
      const pref = prefsBy.get(p.id) ?? { parent_id: p.id, daily_enabled: true, send_hour: 8, categories: [] };
      if (!pref.daily_enabled || alreadySent.has(p.id)) continue;
      // Send on the first run at/after the parent's local send hour (deduped to
      // once/day below). Using >= rather than an exact match means a skipped
      // scheduled run — GitHub Actions cron is best-effort — just delays the tip
      // to the next run instead of dropping it for the whole day.
      if (localHour(now, p.timezone) < pref.send_hour) continue;
      const child = firstChild.get(p.id);
      if (!child) continue;

      considered += 1;
      const cats = (pref.categories ?? []) as Category[];
      const requestedCategory = cats.length
        ? (cats[Math.abs(hashString(`${p.id}:${today}`)) % cats.length] ?? null)
        : null;

      const card = await selectFeedCard(app.db, p.id, child, {
        isDaily: true,
        now,
        timezone: p.timezone,
        requestedCategory,
      });
      if (!card) continue;

      const body = card.insight.length > 120 ? `${card.insight.slice(0, 117)}…` : card.insight;
      const res = await sendToParent(app.db, app.config, p.id, {
        title: `A tip for ${child.name || "your little one"}`,
        body,
        url: "/today",
      });

      if (res.sent > 0) {
        sent += 1;
        await app.db.from("messages").insert({
          parent_id: p.id,
          child_id: child.id,
          tip_id: card.tip_id,
          category_family: card.category,
          message_type: "daily_push",
          channel: "push",
          send_status: "sent",
          send_date: today,
          sent_at: now.toISOString(),
        });
      }
    }

    // --- Admin broadcasts: send any that are now due, to all subscribed parents.
    const { data: dueBroadcasts } = await app.db
      .from("broadcasts")
      .select("id, title, body, url")
      .eq("status", "scheduled")
      .lte("scheduled_for", now.toISOString());

    let broadcastsSent = 0;
    for (const b of (dueBroadcasts ?? []) as Array<{ id: string; title: string; body: string; url: string | null }>) {
      const count = await sendBroadcastToAll(app.db, app.config, b);
      await app.db
        .from("broadcasts")
        .update({ status: "sent", sent_at: now.toISOString(), sent_count: count })
        .eq("id", b.id);
      broadcastsSent += 1;
    }

    return reply.send({ considered, sent, broadcastsSent });
  });
}
