// Typed API client for the Expo app. Wraps the EPIC 4 endpoints, attaching the
// Supabase JWT to every request. Shared response types come from @daybyday/schemas.
import {
  type FeedCard,
  type MeResponse,
  type RequestType,
  stageForAgeDays,
  type StageKey,
} from "@daybyday/schemas";
import { supabase } from "./supabase";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const t = await token();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body.error ?? {}) as { code?: string; message?: string };
    throw new ApiError(res.status, err.code ?? "INTERNAL", err.message ?? `API ${res.status}`);
  }
  return body as T;
}

export interface BootstrapInput {
  name: string;
  timezone?: string;
  focus_area?: "daily_guidance" | "sleep_support" | "big_feelings";
  sms_opt_in?: boolean;
}

export const api = {
  bootstrap: (input: BootstrapInput) =>
    request<{ parent_id: string; onboarding_step: string }>("/v1/account/bootstrap", {
      method: "POST",
      body: JSON.stringify({ timezone: "America/Denver", sms_opt_in: false, ...input }),
    }),

  me: () => request<MeResponse>("/v1/me"),

  updateProfile: (input: { name?: string; focus_area?: string }) =>
    request<MeResponse["parent"]>("/v1/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  createChild: (input: { name: string; birthdate?: string; due_date?: string; gender?: string }) =>
    request<MeResponse["children"][number]>("/v1/children", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateChild: (id: string, input: { name?: string; birthdate?: string }) =>
    request<MeResponse["children"][number]>(`/v1/children/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteChild: (id: string) =>
    request<void>(`/v1/children/${id}`, { method: "DELETE" }),

  completeOnboarding: () =>
    request<{ onboarding_step: string }>("/v1/onboarding/complete", { method: "POST" }),

  feedToday: (childId: string) =>
    request<FeedCard>(`/v1/feed/today?child_id=${encodeURIComponent(childId)}`),

  quickAction: (childId: string, requestType: RequestType) =>
    request<FeedCard>("/v1/feed/quick-action", {
      method: "POST",
      body: JSON.stringify({ child_id: childId, request_type: requestType }),
    }),

  feedback: (tipId: string, childId: string, helpful: boolean) =>
    request<void>(`/v1/feed/${encodeURIComponent(tipId)}/feedback`, {
      method: "POST",
      body: JSON.stringify({ child_id: childId, helpful }),
    }),

  faq: (childId: string) =>
    request<{ questions: string[] }>(`/v1/faq?child_id=${encodeURIComponent(childId)}`),

  ask: (childId: string, question: string) =>
    request<{ question_id: string; matched: boolean; answer: FeedCard | null }>("/v1/questions", {
      method: "POST",
      body: JSON.stringify({ child_id: childId, question }),
    }),

  vapidKey: () => request<{ publicKey: string | null }>("/v1/push/vapid"),

  pushSubscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    request<{ ok: boolean }>("/v1/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),

  pushUnsubscribe: (endpoint: string) =>
    request<void>("/v1/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint }) }),

  pushTest: () => request<{ sent: number }>("/v1/push/test", { method: "POST" }),

  getNotifPrefs: () =>
    request<{ daily_enabled: boolean; send_hour: number; categories: string[] }>("/v1/notification-prefs"),

  updateNotifPrefs: (input: { daily_enabled?: boolean; send_hour?: number; categories?: string[] }) =>
    request<{ daily_enabled: boolean; send_hour: number; categories: string[] }>("/v1/notification-prefs", {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  // Admin
  adminBroadcasts: () => request<{ broadcasts: Broadcast[] }>("/v1/admin/broadcasts"),

  createBroadcast: (input: { title: string; body: string; url?: string; scheduled_for: string }) =>
    request<Broadcast>("/v1/admin/broadcasts", { method: "POST", body: JSON.stringify(input) }),

  cancelBroadcast: (id: string) =>
    request<void>(`/v1/admin/broadcasts/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  url: string | null;
  audience?: string;
  scheduled_for: string;
  status: "scheduled" | "sent" | "canceled";
  sent_at?: string | null;
  sent_count?: number | null;
}

export { ApiError };

/** Re-export so the UI can render stage badges without a round-trip. */
export function stageBadge(ageDays: number): StageKey | null {
  return stageForAgeDays(ageDays);
}
