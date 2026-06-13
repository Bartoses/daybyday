import type { FastifyReply, FastifyRequest } from "fastify";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

/**
 * Verifies the Supabase JWT on the Authorization header and attaches the auth user.
 * The resolved DaybyDay `parent` is loaded by route handlers (EPIC 4); this baseline
 * plugin establishes the authenticated identity and the per-request Supabase client.
 */
declare module "fastify" {
  interface FastifyRequest {
    authUserId?: string;
    authEmail?: string;
    supabase?: SupabaseClient;
  }
}

export function makeAuthPreHandler(config: AppConfig) {
  return async function authPreHandler(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      return reply.code(401).send({
        error: { code: "UNAUTHENTICATED", message: "Missing bearer token" },
      });
    }

    // A request-scoped client carrying the caller's JWT so Postgres RLS applies.
    const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return reply.code(401).send({
        error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" },
      });
    }

    req.authUserId = data.user.id;
    req.authEmail = data.user.email?.toLowerCase();
    req.supabase = supabase;
  };
}
