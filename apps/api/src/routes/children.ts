import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { CreateChildRequest } from "@daybyday/schemas";
import { stageForAgeDays } from "@daybyday/engine";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import { childAgeDays, type ChildRow } from "../feed/service.js";

const CHILD_COLUMNS =
  "id, parent_id, name, birthdate, due_date, gender, photo_url, status, created_at, updated_at";

function enrich(child: ChildRow, now: Date) {
  const age = child.birthdate ? childAgeDays(child, now) : null;
  return { ...child, age_days: age, stage: age !== null ? stageForAgeDays(age) : null };
}

/** Children CRUD + onboarding completion. (T4.1.3) */
export async function childrenRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // POST /v1/children
  app.post("/v1/children", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateChildRequest.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: parsed.error.message } });
    }
    const body = parsed.data;
    const { data, error } = await app.db
      .from("children")
      .insert({
        parent_id: req.parent!.id,
        name: body.name,
        birthdate: body.birthdate ?? null,
        due_date: body.due_date ?? null,
        gender: body.gender ?? null,
      })
      .select(CHILD_COLUMNS)
      .single();

    if (error || !data) {
      return reply.code(500).send({ error: { code: "INTERNAL", message: error?.message ?? "insert failed" } });
    }
    return reply.code(201).send(enrich(data as ChildRow, new Date()));
  });

  // PATCH /v1/children/:id
  app.patch("/v1/children/:id", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    for (const k of ["name", "birthdate", "due_date", "gender", "photo_url", "status"]) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    const { data, error } = await app.db
      .from("children")
      .update(updates)
      .eq("id", id)
      .eq("parent_id", req.parent!.id) // scope to owner
      .select(CHILD_COLUMNS)
      .maybeSingle();

    if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
    if (!data) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });
    return reply.send(enrich(data as ChildRow, new Date()));
  });

  // DELETE /v1/children/:id
  app.delete("/v1/children/:id", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { error } = await app.db
      .from("children")
      .delete()
      .eq("id", id)
      .eq("parent_id", req.parent!.id);
    if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
    return reply.code(204).send();
  });

  // POST /v1/onboarding/complete — mark ONBOARDED.
  app.post(
    "/v1/onboarding/complete",
    { preHandler },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { error } = await app.db
        .from("parents")
        .update({ onboarding_step: "ONBOARDED" })
        .eq("id", req.parent!.id);
      if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
      return reply.send({ onboarding_step: "ONBOARDED" });
    },
  );
}
