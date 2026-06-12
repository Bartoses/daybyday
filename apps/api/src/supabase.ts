import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "./config.js";

/**
 * Service-role Supabase client. Bypasses RLS by design (see 0003_rls.sql note) —
 * the API is a trusted server that scopes every query by the resolved parent_id.
 * Used for all data reads/writes in feature routes; the per-request RLS client in
 * plugins/auth.ts is only for verifying the caller's JWT.
 */
export function makeServiceClient(config: AppConfig): SupabaseClient {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

declare module "fastify" {
  interface FastifyInstance {
    db: SupabaseClient;
  }
}
