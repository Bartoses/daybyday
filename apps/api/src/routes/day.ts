import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent, type ParentRow } from "../plugins/parent.js";
import { buildSystemPrompt, makeDayClient, type DayChildContext } from "../day/service.js";

const HISTORY_FOR_CONTEXT = 10; // recent turns passed to the model
const MAX_MESSAGE_LEN = 4000;

interface DayMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  child_id: string | null;
  created_at: string;
}

/** Premium parents skip the free-tier limit. (Stripe wiring lands later.) */
function isPremium(parent: ParentRow): boolean {
  const prefs = parent.preferences ?? {};
  return prefs["subscription_status"] === "premium" || prefs["premium"] === true;
}

/** ISO start of the current UTC day, for the per-day free-message count. */
function startOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

async function loadChildren(app: FastifyInstance, parentId: string): Promise<DayChildContext[]> {
  const { data } = await app.db
    .from("children")
    .select("name, birthdate, due_date")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });
  return (data as DayChildContext[] | null) ?? [];
}

/** Routes for the "Day" AI assistant — streaming chat + history. */
export async function dayRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  // GET /v1/day/messages — chat history, oldest-first for rendering.
  app.get("/v1/day/messages", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = Math.min(Number((req.query as { limit?: string }).limit) || 50, 200);
    const { data } = await app.db
      .from("day_chat_messages")
      .select("id, role, content, child_id, created_at")
      .eq("parent_id", req.parent!.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = ((data as DayMessageRow[] | null) ?? []).reverse();
    return reply.send({ messages: rows, limit: app.config.day.freeDailyLimit });
  });

  // POST /v1/day/chat — ask Day a question; streams the reply as SSE.
  app.post("/v1/day/chat", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as { message?: string; child_id?: string };
    const message = (body.message ?? "").trim().slice(0, MAX_MESSAGE_LEN);
    if (!message) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "message required" } });
    }

    const parent = req.parent!;
    const client = makeDayClient(app.config);
    if (!client) {
      return reply.code(503).send({
        error: {
          code: "DAY_UNAVAILABLE",
          message: "Day isn't set up yet. (Missing ANTHROPIC_API_KEY.)",
        },
      });
    }

    const now = new Date();

    // Free-tier daily gate (premium = unlimited; limit 0 = unlimited).
    // Launch phase: DAY_FREE_DAILY_LIMIT defaults to 0, so every account —
    // current and new — gets unlimited Day chat until billing ships.
    const limit = app.config.day.freeDailyLimit;
    if (limit > 0 && !isPremium(parent)) {
      const { count } = await app.db
        .from("day_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", parent.id)
        .eq("role", "assistant")
        .gte("created_at", startOfUtcDay(now));
      if ((count ?? 0) >= limit) {
        return reply.code(402).send({
          error: {
            code: "DAY_LIMIT",
            message: `You've used your ${limit} free Day messages today. Upgrade to Premium for unlimited.`,
          },
        });
      }
    }

    const children = await loadChildren(app, parent.id);
    const focusAreas = parent.focus_area ? [parent.focus_area] : [];
    const systemPrompt = buildSystemPrompt(parent.name, children, focusAreas, now);

    // Recent turns for conversational context (oldest-first).
    const { data: hist } = await app.db
      .from("day_chat_messages")
      .select("role, content")
      .eq("parent_id", parent.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_FOR_CONTEXT);
    const history = (
      (hist as { role: "user" | "assistant"; content: string }[] | null) ?? []
    ).reverse();

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ];

    // Persist the user turn before streaming the reply.
    await app.db.from("day_chat_messages").insert({
      parent_id: parent.id,
      child_id: body.child_id ?? null,
      role: "user",
      content: message,
    });

    // Stream the reply as Server-Sent Events. The client reads this with a
    // fetch ReadableStream (not EventSource) so it can send the bearer token.
    reply.hijack();
    const origin = (req.headers.origin as string | undefined) ?? "*";
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": origin,
      "x-accel-buffering": "no",
    });
    const send = (obj: unknown) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);

    let full = "";
    try {
      const stream = client.messages.stream({
        model: app.config.day.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          full += event.delta.text;
          send({ type: "delta", text: event.delta.text });
        }
      }
      await stream.finalMessage();
    } catch (err) {
      req.log.error({ err }, "day chat stream failed");
      send({ type: "error", message: "Day had trouble answering. Please try again." });
      reply.raw.end();
      return;
    }

    // Persist the assistant turn so history survives reload.
    if (full.trim()) {
      await app.db.from("day_chat_messages").insert({
        parent_id: parent.id,
        child_id: body.child_id ?? null,
        role: "assistant",
        content: full,
      });
    }

    send({ type: "done" });
    reply.raw.end();
  });
}
