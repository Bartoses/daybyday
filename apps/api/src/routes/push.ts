import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import { sendToParent } from "../push/service.js";

interface SubscribeBody {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  endpoint?: string;
}

/** Web Push subscribe / unsubscribe / test. */
export async function pushRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // Expose the VAPID public key so the client can subscribe (no auth needed).
  app.get("/v1/push/vapid", async (_req, reply) => {
    return reply.send({ publicKey: app.config.vapid.publicKey || null });
  });

  // POST /v1/push/subscribe — store a browser PushSubscription.
  app.post("/v1/push/subscribe", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as SubscribeBody;
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "Invalid subscription" } });
    }
    const { error } = await app.db.from("web_push_subscriptions").upsert(
      {
        parent_id: req.parent!.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: req.headers["user-agent"] ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
    return reply.code(201).send({ ok: true });
  });

  // DELETE /v1/push/subscribe — remove a subscription by endpoint.
  app.delete("/v1/push/subscribe", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const endpoint = ((req.body ?? {}) as SubscribeBody).endpoint;
    if (!endpoint) return reply.code(400).send({ error: { code: "VALIDATION", message: "endpoint required" } });
    await app.db
      .from("web_push_subscriptions")
      .delete()
      .eq("parent_id", req.parent!.id)
      .eq("endpoint", endpoint);
    return reply.code(204).send();
  });

  // POST /v1/push/test — send a test notification to the caller's devices.
  app.post("/v1/push/test", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await sendToParent(app.db, app.config, req.parent!.id, {
      title: "DaybyDay",
      body: "🎉 Notifications are on. You'll get a gentle daily nudge here.",
      url: "/today",
    });
    if (result.sent === 0) {
      return reply.code(409).send({
        error: { code: "NOT_FOUND", message: "No active devices (or push not configured)" },
      });
    }
    return reply.send({ sent: result.sent });
  });
}
