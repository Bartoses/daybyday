import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { resolveParent } from "../plugins/parent.js";

/** True if the authenticated caller is the configured admin. */
export function isAdmin(req: FastifyRequest, app: FastifyInstance): boolean {
  return Boolean(req.authEmail && req.authEmail === app.config.adminEmail);
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
      .select("id, title, body, url, audience, scheduled_for, status, sent_at, sent_count, created_at")
      .order("scheduled_for", { ascending: false })
      .limit(50);
    return reply.send({ broadcasts: data ?? [] });
  });

  // POST /v1/admin/broadcasts — schedule a custom message.
  app.post("/v1/admin/broadcasts", { preHandler: auth }, async (req, reply) => {
    if (!guard(req, reply)) return;
    const body = (req.body ?? {}) as { title?: string; body?: string; url?: string; scheduled_for?: string };
    const title = (body.title ?? "").trim();
    const message = (body.body ?? "").trim();
    const when = body.scheduled_for ? new Date(body.scheduled_for) : null;
    if (!title || !message || !when || Number.isNaN(when.getTime())) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "title, body, scheduled_for required" } });
    }
    const parent = await resolveParent(req);
    const { data, error } = await app.db
      .from("broadcasts")
      .insert({
        title,
        body: message,
        url: body.url?.trim() || null,
        scheduled_for: when.toISOString(),
        created_by: parent?.id ?? null,
      })
      .select("id, title, body, url, scheduled_for, status")
      .single();
    if (error || !data) {
      return reply.code(500).send({ error: { code: "INTERNAL", message: error?.message ?? "insert failed" } });
    }
    return reply.code(201).send(data);
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
