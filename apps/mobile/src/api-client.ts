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
      body: JSON.stringify({
        timezone: deviceTimezone() ?? "America/Denver",
        sms_opt_in: false,
        ...input,
      }),
    }),

  me: () => request<MeResponse>("/v1/me"),

  updateProfile: (input: { name?: string; focus_area?: string; timezone?: string }) =>
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

  deleteChild: (id: string) => request<void>(`/v1/children/${id}`, { method: "DELETE" }),

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

  dayHistory: () => request<{ messages: DayMessage[]; limit: number }>("/v1/day/messages"),

  milestones: (childId: string) =>
    request<{ child_id: string; age_months: number; milestones: MilestoneItem[] }>(
      `/v1/milestones?child_id=${encodeURIComponent(childId)}`,
    ),

  achieveMilestone: (key: string, childId: string, achievedOn?: string) =>
    request<void>(`/v1/milestones/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({ child_id: childId, achieved_on: achievedOn }),
    }),

  unachieveMilestone: (key: string, childId: string) =>
    request<void>(
      `/v1/milestones/${encodeURIComponent(key)}?child_id=${encodeURIComponent(childId)}`,
      {
        method: "DELETE",
      },
    ),

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
    request<{ daily_enabled: boolean; send_hour: number; categories: string[] }>(
      "/v1/notification-prefs",
    ),

  updateNotifPrefs: (input: {
    daily_enabled?: boolean;
    send_hour?: number;
    categories?: string[];
  }) =>
    request<{ daily_enabled: boolean; send_hour: number; categories: string[] }>(
      "/v1/notification-prefs",
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    ),

  // Admin
  adminBroadcasts: () => request<{ broadcasts: Broadcast[] }>("/v1/admin/broadcasts"),

  createBroadcast: (input: {
    title: string;
    body: string;
    url?: string;
    scheduled_for?: string;
    send_now?: boolean;
  }) => request<Broadcast>("/v1/admin/broadcasts", { method: "POST", body: JSON.stringify(input) }),

  sendBroadcastNow: (id: string) =>
    request<{ sent: number }>(`/v1/admin/broadcasts/${encodeURIComponent(id)}/send`, {
      method: "POST",
    }),

  cancelBroadcast: (id: string) =>
    request<void>(`/v1/admin/broadcasts/${encodeURIComponent(id)}`, { method: "DELETE" }),

  adminAnalytics: () => request<Analytics>("/v1/admin/analytics"),

  progress: () => request<Progress>("/v1/progress"),
};

export interface Progress {
  current_streak: number;
  longest_streak: number;
  tips_learned: number;
  days_active: number;
  seen_today: boolean;
}

export interface AnalyticsWindow {
  active_parents: number;
  daily_views: number;
  quick_actions: number;
  day_questions: number;
  milestones_marked: number;
}
export interface Analytics {
  totals: { parents: number; children: number; parents_with_push: number };
  last7: AnalyticsWindow;
  last30: AnalyticsWindow;
  screens: { name: string; count: number }[];
  top_events: { name: string; count: number }[];
}

/** The device's IANA timezone (e.g. "America/New_York"), or undefined if unknown. */
export function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget product-analytics event. Never throws into the UI. */
export function track(name: string, props?: Record<string, unknown>): void {
  void request<void>("/v1/events", {
    method: "POST",
    body: JSON.stringify({ name, props }),
  }).catch(() => {});
}

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

export interface MilestoneItem {
  key: string;
  label: string;
  description: string;
  category: string;
  age_months: number;
  age_label: string;
  status: "done" | "past" | "now" | "upcoming";
  achieved_on: string | null;
  ask_prompt: string;
}

export interface DayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  child_id: string | null;
  created_at: string;
}

/**
 * Ask "Day" a question and stream the reply. Reads the SSE response with a fetch
 * ReadableStream (so we can send the bearer token, which EventSource can't).
 * Calls onDelta for each text chunk and resolves with the full reply.
 * Throws ApiError on the daily limit (402) or when Day isn't configured (503).
 */
export async function dayChat(
  message: string,
  childId: string | null,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const t = await token();
  const res = await fetch(`${BASE_URL}/v1/day/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(t ? { authorization: `Bearer ${t}` } : {}),
    },
    body: JSON.stringify({ message, child_id: childId ?? undefined }),
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const err = (body.error ?? {}) as { code?: string; message?: string };
    throw new ApiError(res.status, err.code ?? "INTERNAL", err.message ?? `API ${res.status}`);
  }

  let full = "";
  const handleEvent = (raw: string) => {
    const line = raw.startsWith("data:") ? raw.slice(5).trim() : raw.trim();
    if (!line) return;
    let evt: { type?: string; text?: string; message?: string };
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    if (evt.type === "delta" && evt.text) {
      full += evt.text;
      onDelta(evt.text);
    } else if (evt.type === "error") {
      throw new ApiError(500, "DAY_ERROR", evt.message ?? "Day had trouble answering.");
    }
  };

  // Stream incrementally when the platform supports it; otherwise parse the whole body.
  if (res.body && typeof (res.body as ReadableStream).getReader === "function") {
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) handleEvent(part);
    }
    if (buffer) handleEvent(buffer);
  } else {
    const text = await res.text();
    for (const part of text.split("\n\n")) handleEvent(part);
  }

  return full;
}

export { ApiError };

/** Re-export so the UI can render stage badges without a round-trip. */
export function stageBadge(ageDays: number): StageKey | null {
  return stageForAgeDays(ageDays);
}
