import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hashString } from "@daybyday/engine";
import type { Category } from "@daybyday/schemas";
import { selectFeedCard, localHour, localDateKey, type ChildRow } from "../feed/service.js";
import { sendToParent, sendBroadcastToAll } from "../push/service.js";
import { sendEmail } from "../email/resend.js";
import { buildWeeklyDigest } from "../email/digest.js";
import { MILESTONES, ageMonths } from "../milestones/data.js";

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
    // Dedupe is keyed on each parent's LOCAL day (computed per-parent below). We
    // prefetch recent sends from yesterday-UTC onward to cover every parent's
    // local "today" regardless of their offset.
    const yesterdayUtc = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    // Only consider parents who have at least one push subscription.
    const { data: subRows } = await app.db.from("web_push_subscriptions").select("parent_id");
    const parentIds = [
      ...new Set((subRows ?? []).map((r) => (r as { parent_id: string }).parent_id)),
    ];

    const considered0 = parentIds.length === 0;
    const [{ data: parents }, { data: prefs }, { data: children }, { data: sentRows }] = considered0
      ? [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
          app.db.from("parents").select("id, name, timezone").in("id", parentIds),
          app.db
            .from("notification_prefs")
            .select("parent_id, daily_enabled, send_hour, categories")
            .in("parent_id", parentIds),
          app.db
            .from("children")
            .select("id, parent_id, name, birthdate, due_date, created_at")
            .in("parent_id", parentIds)
            .order("created_at", { ascending: true }),
          app.db
            .from("messages")
            .select("parent_id, send_date")
            .eq("message_type", "daily_push")
            .gte("send_date", yesterdayUtc)
            .in("parent_id", parentIds),
        ]);

    const prefsBy = new Map<string, PrefRow>(
      (prefs ?? []).map((p) => [(p as PrefRow).parent_id, p as PrefRow]),
    );
    const firstChild = new Map<string, ChildRow>();
    for (const c of (children ?? []) as Array<ChildRow & { parent_id: string }>) {
      if (!firstChild.has(c.parent_id)) firstChild.set(c.parent_id, c);
    }
    // Key: `${parent_id}:${local_send_date}` so a parent gets one push per local day.
    const sentByParentDay = new Set(
      ((sentRows ?? []) as Array<{ parent_id: string; send_date: string }>).map(
        (r) => `${r.parent_id}:${r.send_date}`,
      ),
    );

    let considered = 0;
    let sent = 0;

    for (const p of (parents ?? []) as ParentRow[]) {
      const pref = prefsBy.get(p.id) ?? {
        parent_id: p.id,
        daily_enabled: true,
        send_hour: 8,
        categories: [],
      };
      const localToday = localDateKey(now, p.timezone);
      if (!pref.daily_enabled || sentByParentDay.has(`${p.id}:${localToday}`)) continue;
      // Send on the first run at/after the parent's local send hour (deduped to
      // once per local day above). Using >= rather than an exact match means a
      // skipped scheduled run — GitHub Actions cron is best-effort — just delays
      // the tip to the next run instead of dropping it for the whole day.
      if (localHour(now, p.timezone) < pref.send_hour) continue;
      const child = firstChild.get(p.id);
      if (!child) continue;

      considered += 1;
      const cats = (pref.categories ?? []) as Category[];
      const requestedCategory = cats.length
        ? (cats[Math.abs(hashString(`${p.id}:${localToday}`)) % cats.length] ?? null)
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
          send_date: localToday,
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
    for (const b of (dueBroadcasts ?? []) as Array<{
      id: string;
      title: string;
      body: string;
      url: string | null;
    }>) {
      const count = await sendBroadcastToAll(app.db, app.config, b);
      await app.db
        .from("broadcasts")
        .update({ status: "sent", sent_at: now.toISOString(), sent_count: count })
        .eq("id", b.id);
      broadcastsSent += 1;
    }

    return reply.send({ considered, sent, broadcastsSent });
  });

  // Weekly digest — a warm Sunday recap email to every parent with email on.
  // Triggered weekly by GitHub Actions; deduped to once per ~week per parent.
  app.post("/v1/internal/cron/weekly-digest", async (req: FastifyRequest, reply: FastifyReply) => {
    const secret = req.headers["x-cron-secret"];
    if (!app.config.cronSecret || secret !== app.config.cronSecret) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Invalid cron secret" } });
    }
    if (!app.config.email.apiKey) {
      return reply.send({ skipped: "email not configured", considered: 0, sent: 0 });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const since7 = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const dedupeSince = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);

    const { data: parents } = await app.db
      .from("parents")
      .select("id, name, auth_user_id, timezone");
    const rows = (parents ?? []) as Array<{
      id: string;
      name: string | null;
      auth_user_id: string | null;
      timezone: string;
    }>;
    if (rows.length === 0) return reply.send({ considered: 0, sent: 0 });
    const ids = rows.map((p) => p.id);

    const [{ data: prefs }, { data: children }, { data: recent }, authList] = await Promise.all([
      app.db.from("notification_prefs").select("parent_id, email_enabled").in("parent_id", ids),
      app.db
        .from("children")
        .select("id, parent_id, name, birthdate, due_date, created_at")
        .in("parent_id", ids)
        .order("created_at", { ascending: true }),
      app.db
        .from("messages")
        .select("parent_id")
        .eq("message_type", "weekly_digest")
        .gte("send_date", dedupeSince)
        .in("parent_id", ids),
      app.db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const emailOff = new Set(
      ((prefs ?? []) as Array<{ parent_id: string; email_enabled: boolean }>)
        .filter((p) => p.email_enabled === false)
        .map((p) => p.parent_id),
    );
    const firstChild = new Map<string, ChildRow & { parent_id: string }>();
    for (const c of (children ?? []) as Array<ChildRow & { parent_id: string }>) {
      if (!firstChild.has(c.parent_id)) firstChild.set(c.parent_id, c);
    }
    const alreadySent = new Set(
      ((recent ?? []) as Array<{ parent_id: string }>).map((r) => r.parent_id),
    );
    const emailByUser = new Map<string, string>();
    for (const u of authList.data?.users ?? []) {
      if (u.id && u.email) emailByUser.set(u.id, u.email);
    }

    let considered = 0;
    let sent = 0;

    for (const p of rows) {
      if (emailOff.has(p.id) || alreadySent.has(p.id)) continue;
      const email = p.auth_user_id ? emailByUser.get(p.auth_user_id) : undefined;
      const child = firstChild.get(p.id);
      if (!email || !child) continue;
      considered += 1;

      const card = await selectFeedCard(app.db, p.id, child, {
        isDaily: true,
        now,
        timezone: p.timezone,
      });
      const months = child.birthdate ? ageMonths(child.birthdate, now) : 0;
      const next = MILESTONES.filter((m) => m.age_months > months).sort(
        (a, b) => a.age_months - b.age_months,
      )[0];

      const { data: dd } = await app.db
        .from("messages")
        .select("send_date")
        .eq("parent_id", p.id)
        .eq("message_type", "daily")
        .order("send_date", { ascending: false })
        .limit(400);
      const dates = new Set(
        ((dd ?? []) as Array<{ send_date: string | null }>)
          .map((r) => r.send_date)
          .filter((d): d is string => Boolean(d)),
      );

      const { subject, html } = buildWeeklyDigest({
        parentName: p.name?.trim() || "there",
        childName: child.name,
        tipsThisWeek: [...dates].filter((d) => d >= since7).length,
        totalTips: dates.size,
        streak: currentStreak(dates, today),
        featured: card ? { insight: card.insight, action: card.action_tip } : null,
        milestone: next
          ? {
              label: next.label,
              age_label: monthsLabel(next.age_months),
              description: next.description,
            }
          : null,
        appUrl: app.config.email.appUrl,
      });

      const ok = await sendEmail(app.config, { to: email, subject, html });
      if (ok) {
        sent += 1;
        await app.db.from("messages").insert({
          parent_id: p.id,
          child_id: child.id,
          message_type: "weekly_digest",
          channel: "email",
          send_status: "sent",
          send_date: today,
          sent_at: now.toISOString(),
        });
      }
    }

    return reply.send({ considered, sent });
  });
}

/** Consecutive-day streak ending today/yesterday, from a set of YYYY-MM-DD keys. */
function currentStreak(dates: Set<string>, today: string): number {
  const shift = (key: string, delta: number): string => {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  let anchor = dates.has(today) ? today : dates.has(shift(today, -1)) ? shift(today, -1) : null;
  let n = 0;
  while (anchor && dates.has(anchor)) {
    n += 1;
    anchor = shift(anchor, -1);
  }
  return n;
}

/** "~6 months" / "~3 years" for a milestone's typical age. */
function monthsLabel(months: number): string {
  if (months < 1) return "Newborn";
  if (months < 24) return `~${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 12);
  return `~${years} year${years === 1 ? "" : "s"}`;
}
