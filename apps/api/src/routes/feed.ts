import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { FeedTodayQuery, QuickActionRequest, FeedbackRequest, type Category } from "@daybyday/schemas";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import {
  selectFeedCard,
  loadCardByTip,
  dateKey,
  type ChildRow,
} from "../feed/service.js";

const CHILD_COLUMNS = "id, parent_id, name, birthdate, due_date";

/** Map a quick-action request_type to a content category (null = engine rotates). */
function categoryForRequest(requestType: string): Category | null {
  switch (requestType) {
    case "sleep":
      return "sleep";
    case "feeding":
      return "feeding";
    case "play":
      return "learning_play";
    case "behavior":
      return "behavior";
    case "another_tip":
    case "daily":
    default:
      return null;
  }
}

async function loadOwnedChild(
  app: FastifyInstance,
  parentId: string,
  childId: string,
): Promise<ChildRow | null> {
  const { data } = await app.db
    .from("children")
    .select(CHILD_COLUMNS)
    .eq("id", childId)
    .eq("parent_id", parentId)
    .maybeSingle();
  return (data as ChildRow | null) ?? null;
}

/** Feed routes: today (idempotent), quick-action (gated), feedback. (T4.2) */
export async function feedRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // GET /v1/feed/today?child_id — idempotent per child per day.
  app.get("/v1/feed/today", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = FeedTodayQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: parsed.error.message } });
    }
    const parentId = req.parent!.id;
    const child = await loadOwnedChild(app, parentId, parsed.data.child_id);
    if (!child) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

    const now = new Date();
    const today = dateKey(now);

    // Idempotency: if today's daily card was already logged, re-render it.
    const { data: existing } = await app.db
      .from("messages")
      .select("tip_id")
      .eq("parent_id", parentId)
      .eq("child_id", child.id)
      .eq("send_date", today)
      .eq("message_type", "daily")
      .maybeSingle();

    if (existing?.tip_id) {
      const card = await loadCardByTip(app.db, child, String(existing.tip_id), now);
      if (card) return reply.send(card);
    }

    const card = await selectFeedCard(app.db, parentId, child, { isDaily: true, now });
    if (!card) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "No content available" } });

    // Log the daily send (unique index enforces one per child/day).
    const { error } = await app.db.from("messages").insert({
      parent_id: parentId,
      child_id: child.id,
      tip_id: card.tip_id,
      category_family: card.category,
      message_type: "daily",
      channel: "in_app",
      insight_rendered: card.insight,
      action_rendered: card.action_tip,
      reassurance_rendered: card.reassurance,
      send_status: "sent",
      send_date: today,
      sent_at: now.toISOString(),
    });
    // A concurrent request may have inserted first; that's fine (idempotent).
    if (error && !error.message.includes("duplicate")) {
      req.log.warn({ err: error.message }, "feed/today message log failed");
    }

    return reply.send(card);
  });

  // POST /v1/feed/quick-action — in-category tip; free tier capped at 1/day.
  app.post(
    "/v1/feed/quick-action",
    { preHandler },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = QuickActionRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION", message: parsed.error.message } });
      }
      const parentId = req.parent!.id;
      const child = await loadOwnedChild(app, parentId, parsed.data.child_id);
      if (!child) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

      const now = new Date();
      const today = dateKey(now);

      // Entitlement: free plan gets the daily card + 1 quick action/day.
      const { data: sub } = await app.db
        .from("subscriptions")
        .select("plan, status")
        .eq("parent_id", parentId)
        .maybeSingle();
      const isPaid = sub?.plan === "premium" || sub?.plan === "family";

      if (!isPaid) {
        const { count } = await app.db
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("parent_id", parentId)
          .eq("child_id", child.id)
          .eq("send_date", today)
          .eq("message_type", "followup");
        if ((count ?? 0) >= 1) {
          return reply.code(402).send({
            error: {
              code: "PAYMENT_REQUIRED",
              message: "Upgrade for unlimited tips",
              details: { feature: "quick_actions", plan: "premium" },
            },
          });
        }
      }

      const category = categoryForRequest(parsed.data.request_type);
      const card = await selectFeedCard(app.db, parentId, child, {
        requestedCategory: category,
        isDaily: false,
        now,
      });
      if (!card) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "No content available" } });

      await app.db.from("messages").insert({
        parent_id: parentId,
        child_id: child.id,
        tip_id: card.tip_id,
        category_family: card.category,
        message_type: "followup",
        request_type: parsed.data.request_type,
        channel: "in_app",
        insight_rendered: card.insight,
        action_rendered: card.action_tip,
        reassurance_rendered: card.reassurance,
        send_status: "sent",
        send_date: today,
        sent_at: now.toISOString(),
      });

      return reply.send(card);
    },
  );

  // POST /v1/feed/:tip_id/feedback — helpful / not-helpful signal.
  app.post(
    "/v1/feed/:tip_id/feedback",
    { preHandler },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { tip_id } = req.params as { tip_id: string };
      const parsed = FeedbackRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "VALIDATION", message: parsed.error.message } });
      }
      const { error } = await app.db.from("tip_feedback").upsert(
        {
          parent_id: req.parent!.id,
          child_id: parsed.data.child_id,
          tip_id,
          helpful: parsed.data.helpful,
        },
        { onConflict: "parent_id, child_id, tip_id" },
      );
      if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
      return reply.code(204).send();
    },
  );
}
