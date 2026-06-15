import { Platform } from "react-native";

/** PWA install detection + the Chrome/Android install prompt. */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function isWeb(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined";
}

// Capture Chrome/Android's install prompt as early as the module loads so we can
// surface a custom "Install" button later. (Imported from app/_layout for early reg.)
if (isWeb()) {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

/** True when launched from the installed Home Screen app (not a browser tab). */
export function isStandalone(): boolean {
  if (!isWeb()) return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mql || iosStandalone;
}

export function isIOS(): boolean {
  if (!isWeb()) return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/** Whether we can show a one-tap install button (Chrome/Android). */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Trigger the native install prompt; resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome === "accepted";
}
