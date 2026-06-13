import { Platform } from "react-native";
import { api } from "./api-client";

/** Web Push helpers (web/PWA only; no-op on native for now). */

export type PushState = "unsupported" | "default" | "denied" | "subscribed" | "granted-not-subscribed";

export function pushSupported(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await readyRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) return "subscribed";
  return Notification.permission === "granted" ? "granted-not-subscribed" : "default";
}

export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) {
    return { ok: false, error: "Notifications aren't supported on this device or browser." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Notification permission wasn't granted." };
  }
  const reg = await readyRegistration();
  if (!reg) return { ok: false, error: "Service worker isn't ready yet — try again in a moment." };

  const { publicKey } = await api.vapidKey();
  if (!publicKey) return { ok: false, error: "Push isn't configured on the server yet." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: "Could not read the push subscription." };
  }
  await api.pushSubscribe({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  const reg = await readyRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    await api.pushUnsubscribe(endpoint).catch(() => {});
  }
}
