import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { resolveParent } from "../plugins/parent.js";
import { sendBroadcastToAll } from "../push/service.js";

/** True if the authenticated caller is the configured admin. */
export function isAdmin(req: FastifyRequest, app: FastifyInstance): boolean {
  return Boolean(req.authEmail && req.authEmail === app.config.adminEmail);
}

/** Normalize a link: in-app "/path" kept; bare domain → https; empty → null. */
function normalizeUrl(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.startsWith("/")) return v;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/** Admin-only broadcast scheduling (custom push messages). Gated by email. */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const auth = makeAuthPreHandler(app.config);

  function guard(req: FastifyRequest, reply: FastifyReply): boolean {
    if (!isAdmin(req, app)) {
      reply.code(403).send({ error: { code: "FORBIDDEN", message: "Admin only" } });
      return false;
    }
    return true;
  }

  // GET /v1/admin/broadcasts — list scheduled + recent.
  app.get("/v1/admin/broadcasts", { preHandler: auth }, async (req, reply) => {
    if (!guard(req, reply)) return;
    const { data } = await app.db
      .from("broadcasts")
      .select(
        "id, title, body, url, audience, scheduled_for, status, sent_at, sent_count, created_at",
      )
      .order("scheduled_for", { ascending: false })
      .limit(50);
    return reply.send({ broadcasts: data ?? [] });
  });

  // POST /v1/admin/broadcasts — schedule a custom message, or send it now.
  app.post("/v1/admin/broadcasts", { preHandler: auth }, async (req, reply) => {
    if (!guard(req, reply)) return;
    const body = (req.body ?? {}) as {
      title?: string;
      body?: string;
      url?: string;
      scheduled_for?: string;
      send_now?: boolean;
    };
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const sendNow = body.send_now === true;
    const when = sendNow ? new Date() : body.scheduled_for ? new Date(body.scheduled_for) : null;
    if (!title || !message || !when || Number.isNaN(when.getTime())) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION", message: "title, body, and a time are required" } });
    }
    const parent = await resolveParent(req);
    const url = normalizeUrl(body.url);

    const { data, error } = await app.db
      .from("broadcasts")
      .insert({
        title,
        body: message,
        url,
        scheduled_for: when.toISOString(),
        created_by: parent?.id ?? null,
      })
      .select("id, title, body, url, scheduled_for, status")
      .single();
    if (error || !data) {
      return reply
        .code(500)
        .send({ error: { code: "INTERNAL", message: error?.message ?? "insert failed" } });
    }

    if (sendNow) {
      const count = await sendBroadcastToAll(app.db, app.config, { title, body: message, url });
      await app.db
        .from("broadcasts")
        .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: count })
        .eq("id", data.id);
      return reply.code(201).send({ ...data, status: "sent", sent_count: count });
    }
    return reply.code(201).send(data);
  });

  // POST /v1/admin/broadcasts/:id/send — send a scheduled broadcast right now.
  app.post("/v1/admin/broadcasts/:id/send", { preHandler: auth }, async (req, reply) => {
    if (!guard(req, reply)) return;
    const { id } = req.params as { id: string };
    const { data: b } = await app.db
      .from("broadcasts")
      .select("id, title, body, url, status")
      .eq("id", id)
      .maybeSingle();
    if (!b)
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Broadcast not found" } });
    if ((b as { status: string }).status === "sent") {
      return reply.code(409).send({ error: { code: "VALIDATION", message: "Already sent" } });
    }
    const bc = b as { title: string; body: string; url: string | null };
    const count = await sendBroadcastToAll(app.db, app.config, bc);
    await app.db
      .from("broadcasts")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_count: count })
      .eq("id", id);
    return reply.send({ sent: count });
  });

  // DELETE /v1/admin/broadcasts/:id — cancel a scheduled broadcast.
  app.delete("/v1/admin/broadcasts/:id", { preHandler: auth }, async (req, reply) => {
    if (!guard(req, reply)) return;
    const { id } = req.params as { id: string };
    const { error } = await app.db
      .from("broadcasts")
      .update({ status: "canceled" })
      .eq("id", id)
      .eq("status", "scheduled");
    if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
    return reply.code(204).send();
  });
}
