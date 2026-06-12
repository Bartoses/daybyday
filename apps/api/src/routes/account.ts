import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BootstrapRequest } from "@daybyday/schemas";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { resolveParent } from "../plugins/parent.js";
import { childAgeDays } from "../feed/service.js";
import { stageForAgeDays } from "@daybyday/engine";
import type { ChildRow } from "../feed/service.js";

/** Account routes: bootstrap (idempotent create) + /me. (T4.1.2) */
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const auth = makeAuthPreHandler(app.config);

  // POST /v1/account/bootstrap — create the parent + initial consent. Idempotent.
  app.post(
    "/v1/account/bootstrap",
    { preHandler: auth },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = BootstrapRequest.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: { code: "VALIDATION", message: parsed.error.message } });
      }
      const body = parsed.data;

      const existing = await resolveParent(req);
      if (existing) {
        return reply.send({ parent_id: existing.id, onboarding_step: existing.onboarding_step });
      }

      const { data, error } = await app.db
        .from("parents")
        .insert({
          auth_user_id: req.authUserId,
          name: body.name,
          timezone: body.timezone,
          focus_area: body.focus_area ?? null,
          sms_opt_in: body.sms_opt_in,
          onboarding_step: "WAITING_CHILD_NAME",
        })
        .select("id, onboarding_step")
        .single();

      if (error || !data) {
        return reply.code(500).send({ error: { code: "INTERNAL", message: error?.message ?? "insert failed" } });
      }

      // Consent provenance (TCPA audit). One row per channel the user acted on.
      await app.db.from("consents").insert({
        parent_id: data.id,
        channel: "sms",
        granted: body.sms_opt_in,
        consent_text: body.consent_text ?? null,
        source: body.consent_source ?? "app_bootstrap",
        method: "app",
      });

      return reply.code(201).send({ parent_id: data.id, onboarding_step: data.onboarding_step });
    },
  );

  // GET /v1/me — parent + children (with derived age/stage) + subscription.
  app.get("/v1/me", { preHandler: auth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parent = await resolveParent(req);
    if (!parent) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "No account; call /v1/account/bootstrap first" },
      });
    }

    const now = new Date();
    const [{ data: children }, { data: subscription }] = await Promise.all([
      app.db
        .from("children")
        .select("id, parent_id, name, birthdate, due_date, gender, photo_url, status, created_at, updated_at")
        .eq("parent_id", parent.id),
      app.db
        .from("subscriptions")
        .select("id, parent_id, plan, period, status, current_period_end")
        .eq("parent_id", parent.id)
        .maybeSingle(),
    ]);

    const enriched = (children ?? []).map((c) => {
      const child = c as ChildRow & Record<string, unknown>;
      const age = child.birthdate ? childAgeDays(child, now) : null;
      return { ...child, age_days: age, stage: age !== null ? stageForAgeDays(age) : null };
    });

    return reply.send({ parent, children: enriched, subscription: subscription ?? null });
  });

  // PATCH /v1/me — update the parent's profile (name, focus, timezone).
  app.patch("/v1/me", { preHandler: auth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parent = await resolveParent(req);
    if (!parent) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "No account; call /v1/account/bootstrap first" },
      });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.focus_area === "string") updates.focus_area = body.focus_area;
    if (typeof body.timezone === "string") updates.timezone = body.timezone;
    if (typeof body.preferred_send_hour === "number") updates.preferred_send_hour = body.preferred_send_hour;

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "No updatable fields" } });
    }

    const { data, error } = await app.db
      .from("parents")
      .update(updates)
      .eq("id", parent.id)
      .select(
        "id, auth_user_id, name, timezone, onboarding_step, focus_area, status, sms_opt_in, preferred_send_hour, preferences",
      )
      .single();

    if (error || !data) {
      return reply.code(500).send({ error: { code: "INTERNAL", message: error?.message ?? "update failed" } });
    }
    return reply.send(data);
  });
}
