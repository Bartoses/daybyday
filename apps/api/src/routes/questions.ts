import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";
import { childAgeDays, loadCardByTip, type ChildRow } from "../feed/service.js";
import { matchTipForQuestion, faqForAge } from "../questions/service.js";

const CHILD_COLUMNS = "id, parent_id, name, birthdate, due_date";

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

/** Ask a question + curated FAQ. (pre-assistant content matching) */
export async function questionRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // GET /v1/faq?child_id — curated common questions for the child's age.
  app.get("/v1/faq", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const childId = (req.query as { child_id?: string }).child_id;
    if (!childId)
      return reply.code(400).send({ error: { code: "VALIDATION", message: "child_id required" } });
    const child = await loadOwnedChild(app, req.parent!.id, childId);
    if (!child)
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

    const questions = await faqForAge(app.db, childAgeDays(child, new Date()));
    return reply.send({ questions });
  });

  // POST /v1/questions — ask a question; matches to a tip and logs it.
  app.post("/v1/questions", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as { child_id?: string; question?: string };
    const question = (body.question ?? "").trim();
    if (!body.child_id || question.length === 0) {
      return reply
        .code(400)
        .send({ error: { code: "VALIDATION", message: "child_id and question required" } });
    }
    const parentId = req.parent!.id;
    const child = await loadOwnedChild(app, parentId, body.child_id);
    if (!child)
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Child not found" } });

    const now = new Date();
    const tipId = await matchTipForQuestion(app.db, childAgeDays(child, now), question);
    const answer = tipId ? await loadCardByTip(app.db, child, tipId, now) : null;

    const { data, error } = await app.db
      .from("questions")
      .insert({
        parent_id: parentId,
        child_id: child.id,
        question,
        status: answer ? "answered" : "new",
      })
      .select("id")
      .single();

    if (error || !data) {
      return reply
        .code(500)
        .send({ error: { code: "INTERNAL", message: error?.message ?? "insert failed" } });
    }

    return reply.send({ question_id: data.id, matched: answer !== null, answer });
  });

  // GET /v1/questions — the parent's recent questions (history).
  app.get("/v1/questions", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { data } = await app.db
      .from("questions")
      .select("id, child_id, question, status, created_at")
      .eq("parent_id", req.parent!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return reply.send({ questions: data ?? [] });
  });
}
