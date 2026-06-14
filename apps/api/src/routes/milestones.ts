import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import { MILESTONES, ageMonths, type MilestoneDef } from "../milestones/data.js";

type Status = "done" | "past" | "now" | "upcoming";

interface TimelineItem extends MilestoneDef {
  age_label: string;
  status: Status;
  achieved_on: string | null;
}

async function loadOwnedChild(app: FastifyInstance, parentId: string, childId: string) {
  const { data } = await app.db
    .from("children")
    .select("id, parent_id, name, birthdate, due_date")
    .eq("id", childId)
    .eq("parent_id", parentId)
    .maybeSingle();
  return (data as { id: string; name: string; birthdate: string | null } | null) ?? null;
}

function ageLabel(months: number): string {
  if (months < 1) return "Newborn";
  if (months < 24) return `~${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(months / 12);
  return `~${years} year${years === 1 ? "" : "s"}`;
}

/** Per-child developmental timeline + mark-done. Content is general guidance. */
export async function milestoneRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // GET /v1/milestones?child_id — computed timeline with done status.
  app.get("/v1/milestones", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const childId = (req.query as { child_id?: string }).child_id;
    if (!childId) return reply.code(400).send({ error: { code: "VALIDATION", message: "child_id required" } });
    const child = await loadOwnedChild(app, req.parent!.id, childId);
    if (!child) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

    const { data: achievedRows } = await app.db
      .from("milestones")
      .select("milestone_key, achieved_on")
      .eq("child_id", childId);
    const achieved = new Map(
      ((achievedRows as { milestone_key: string; achieved_on: string | null }[] | null) ?? []).map(
        (r) => [r.milestone_key, r.achieved_on] as const,
      ),
    );

    const now = new Date();
    const months = child.birthdate ? ageMonths(child.birthdate, now) : 0;

    const items: TimelineItem[] = MILESTONES.map((m) => {
      const isDone = achieved.has(m.key);
      let status: Status;
      if (isDone) status = "done";
      else if (months > m.age_months + 2) status = "past";
      else if (months >= m.age_months - 2) status = "now";
      else status = "upcoming";
      return { ...m, age_label: ageLabel(m.age_months), status, achieved_on: achieved.get(m.key) ?? null };
    }).sort((a, b) => a.age_months - b.age_months);

    return reply.send({ child_id: childId, age_months: months, milestones: items });
  });

  // POST /v1/milestones/:key — mark a milestone done (idempotent upsert).
  app.post("/v1/milestones/:key", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const key = (req.params as { key: string }).key;
    const body = (req.body ?? {}) as { child_id?: string; achieved_on?: string };
    const def = MILESTONES.find((m) => m.key === key);
    if (!def) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Unknown milestone" } });
    if (!body.child_id) return reply.code(400).send({ error: { code: "VALIDATION", message: "child_id required" } });
    const child = await loadOwnedChild(app, req.parent!.id, body.child_id);
    if (!child) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

    const { error } = await app.db.from("milestones").upsert(
      {
        child_id: body.child_id,
        milestone_key: key,
        label: def.label,
        achieved_on: body.achieved_on ?? new Date().toISOString().slice(0, 10),
      },
      { onConflict: "child_id, milestone_key" },
    );
    if (error) return reply.code(500).send({ error: { code: "INTERNAL", message: error.message } });
    return reply.code(204).send();
  });

  // DELETE /v1/milestones/:key?child_id — un-mark.
  app.delete("/v1/milestones/:key", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const key = (req.params as { key: string }).key;
    const childId = (req.query as { child_id?: string }).child_id;
    if (!childId) return reply.code(400).send({ error: { code: "VALIDATION", message: "child_id required" } });
    const child = await loadOwnedChild(app, req.parent!.id, childId);
    if (!child) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });
    await app.db.from("milestones").delete().eq("child_id", childId).eq("milestone_key", key);
    return reply.code(204).send();
  });
}
