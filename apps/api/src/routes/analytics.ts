import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import { isAdmin } from "./admin.js";

const MAX_NAME_LEN = 64;

interface Row {
  parent_id: string | null;
  created_at: string;
}

/** Count rows whose created_at is >= since. */
function countSince<T extends { created_at: string }>(rows: T[], since: string): number {
  return rows.filter((r) => r.created_at >= since).length;
}

/** Distinct parent_ids active (any signal) in the window. */
function activeParents(since: string, ...sets: Row[][]): number {
  const ids = new Set<string>();
  for (const rows of sets) {
    for (const r of rows) {
      if (r.parent_id && r.created_at >= since) ids.add(r.parent_id);
    }
  }
  return ids.size;
}

/** Tally a key across rows (counts per distinct value). */
function tally(rows: { key: string }[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.key, (m.get(r.key) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Event ingestion + admin usage dashboard. */
export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const auth = makeAuthPreHandler(app.config);
  const ownerPre = [auth, makeRequireParent()];

  // POST /v1/events — record a product-analytics event for the caller. Lenient:
  // never blocks the UI, so tracking failures are swallowed.
  app.post(
    "/v1/events",
    { preHandler: ownerPre },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body ?? {}) as { name?: string; props?: Record<string, unknown> };
      const name = (body.name ?? "").trim().slice(0, MAX_NAME_LEN);
      if (!name) return reply.code(204).send();
      await app.db
        .from("analytics_events")
        .insert({ parent_id: req.parent!.id, name, props: body.props ?? {} });
      return reply.code(204).send();
    },
  );

  // GET /v1/admin/analytics — usage rollups (admin-gated). Combines tracked events
  // with derived signals from the feature tables so the dashboard is useful from day one.
  app.get(
    "/v1/admin/analytics",
    { preHandler: auth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!isAdmin(req, app)) {
        return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin only" } });
      }

      const now = Date.now();
      const since7 = new Date(now - 7 * 86400000).toISOString();
      const since30 = new Date(now - 30 * 86400000).toISOString();

      const [parentsC, childrenC, push, events, messages, day, milestones] = await Promise.all([
        app.db.from("parents").select("id", { count: "exact", head: true }),
        app.db.from("children").select("id", { count: "exact", head: true }),
        app.db.from("web_push_subscriptions").select("parent_id"),
        app.db
          .from("analytics_events")
          .select("parent_id, name, props, created_at")
          .gte("created_at", since30)
          .limit(20000),
        app.db
          .from("messages")
          .select("parent_id, message_type, created_at")
          .gte("created_at", since30)
          .limit(20000),
        app.db
          .from("day_chat_messages")
          .select("parent_id, role, created_at")
          .gte("created_at", since30)
          .limit(20000),
        app.db.from("milestones").select("created_at").gte("created_at", since30),
      ]);

      const eventRows = (events.data ?? []) as {
        parent_id: string;
        name: string;
        props: Record<string, unknown>;
        created_at: string;
      }[];
      const msgRows = (messages.data ?? []) as {
        parent_id: string;
        message_type: string;
        created_at: string;
      }[];
      const dayRows = (day.data ?? []) as { parent_id: string; role: string; created_at: string }[];
      const msRows = (milestones.data ?? []) as { created_at: string }[];

      const window = (since: string) => ({
        active_parents: activeParents(since, eventRows, msgRows, dayRows),
        daily_views: msgRows.filter((m) => m.message_type === "daily" && m.created_at >= since)
          .length,
        quick_actions: msgRows.filter((m) => m.message_type === "followup" && m.created_at >= since)
          .length,
        day_questions: dayRows.filter((d) => d.role === "user" && d.created_at >= since).length,
        milestones_marked: countSince(msRows, since),
      });

      const screens = tally(
        eventRows
          .filter((e) => e.name === "screen_view")
          .map((e) => ({ key: String((e.props as { screen?: string }).screen ?? "unknown") })),
      );
      const topEvents = tally(eventRows.map((e) => ({ key: e.name })));
      const pushParents = new Set(
        (push.data ?? []).map((r) => (r as { parent_id: string }).parent_id),
      ).size;

      return reply.send({
        totals: {
          parents: parentsC.count ?? 0,
          children: childrenC.count ?? 0,
          parents_with_push: pushParents,
        },
        last7: window(since7),
        last30: window(since30),
        screens,
        top_events: topEvents.slice(0, 12),
      });
    },
  );
}
