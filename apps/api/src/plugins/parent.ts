import type { FastifyReply, FastifyRequest } from "fastify";

/** The resolved DaybyDay parent row attached to the request. */
export interface ParentRow {
  id: string;
  auth_user_id: string | null;
  name: string | null;
  timezone: string;
  onboarding_step: string;
  focus_area: string | null;
  status: string;
  sms_opt_in: boolean;
  preferred_send_hour: number | null;
  preferences: Record<string, unknown>;
}

declare module "fastify" {
  interface FastifyRequest {
    parent?: ParentRow;
  }
}

/**
 * Loads the parent for the authenticated user and attaches it to the request.
 * Runs after the auth preHandler (which sets `authUserId`). Most routes require
 * a parent to exist; `/account/bootstrap` is the exception and handles a null parent.
 */
export async function resolveParent(req: FastifyRequest): Promise<ParentRow | null> {
  if (!req.authUserId) return null;
  const { data } = await req.server.db
    .from("parents")
    .select(
      "id, auth_user_id, name, timezone, onboarding_step, focus_area, status, sms_opt_in, preferred_send_hour, preferences",
    )
    .eq("auth_user_id", req.authUserId)
    .maybeSingle();
  return (data as ParentRow | null) ?? null;
}

/** PreHandler that requires an existing parent (404-style 401 if missing). */
export function makeRequireParent() {
  return async function requireParent(req: FastifyRequest, reply: FastifyReply) {
    const parent = await resolveParent(req);
    if (!parent) {
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "No account; call /v1/account/bootstrap first" },
      });
    }
    req.parent = parent;
  };
}
