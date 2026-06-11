// Minimal typed API client seed for the Expo app. Proves the shared @daybyday/schemas
// types compile in the mobile package too (T1.1.2 AC). The full Expo app (Expo Router,
// screens, Supabase Auth) is scaffolded in EPIC 7 (T7.1.x).
import { type FeedCard, type MeResponse, stageForAgeDays, type StageKey } from "@daybyday/schemas";

export interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
}

export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return (await res.json()) as T;
  }

  return {
    me: () => authedFetch<MeResponse>("/v1/me"),
    feedToday: (childId: string) =>
      authedFetch<FeedCard>(`/v1/feed/today?child_id=${encodeURIComponent(childId)}`),
  };
}

/** Re-export a shared helper so the UI can render stage badges without a round-trip. */
export function stageBadge(ageDays: number): StageKey | null {
  return stageForAgeDays(ageDays);
}
