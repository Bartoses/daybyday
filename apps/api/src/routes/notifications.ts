import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { makeAuthPreHandler } from "../plugins/auth.js";
import { makeRequireParent } from "../plugins/parent.js";

interface PrefsRow {
  daily_enabled: boolean;
  send_hour: number;
  categories: string[] | null;
}

const DEFAULTS = { daily_enabled: true, send_hour: 8, categories: [] as string[] };

/** Per-parent daily reminder preferences (when / whether / what topics). */
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [makeAuthPreHandler(app.config), makeRequireParent()];

  app.get("/v1/notification-prefs", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { data } = await app.db
      .from("notification_prefs")
      .select("daily_enabled, send_hour, categories")
      .eq("parent_id", req.parent!.id)
      .maybeSingle();
    if (!data) {
      await app.db.from("notification_prefs").insert({ parent_id: req.parent!.id });
      return reply.send(DEFAULTS);
    }
    const row = data as PrefsRow;
    return reply.send({
      daily_enabled: row.daily_enabled,
      send_hour: row.send_hour,
      categories: row.categories ?? [],
    });
  });

  app.put("/v1/notification-prefs", { preHandler }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req.body ?? {}) as { daily_enabled?: boolean; send_hour?: number; categories?: string[] };
    const updates: Record<string, unknown> = { parent_id: req.parent!.id };
    if (typeof body.daily_enabled === "boolean") updates.daily_enabled = body.daily_enabled;
    if (typeof body.send_hour === "number") {
      updates.send_hour = Math.max(0, Math.min(23, Math.floor(body.send_hour)));
    }
    if (Array.isArray(body.categories)) updates.categories = body.categories;

    const { data, error } = await app.db
      .from("notification_prefs")
      .upsert(updates, { onConflict: "parent_id" })
      .select("daily_enabled, send_hour, categories")
      .single();
    if (error || !data) {
      return reply.code(500).send({ error: { code: "INTERNAL", message: error?.message ?? "update failed" } });
    }
    const row = data as PrefsRow;
    return reply.send({
      daily_enabled: row.daily_enabled,
      send_hour: row.send_hour,
      categories: row.categories ?? [],
    });
  });
}
