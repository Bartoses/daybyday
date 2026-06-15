import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, font, fonts, radius, spacing } from "../theme";
import { isWeb, isStandalone, isIOS, canPromptInstall, promptInstall } from "../install";
import { getPushState, enablePush, pushSupported } from "../push";

type Mode = "none" | "ios-install" | "install" | "notify";
const DISMISS_KEY = "dbd_install_dismissed";

function installDismissed(): boolean {
  try {
    return isWeb() && window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A single, well-timed nudge that adapts to where the user is in the
 * install → enable-notifications funnel. Shown on the Today screen.
 */
export function GrowthPrompt() {
  const [mode, setMode] = useState<Mode>("none");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function compute() {
    if (!isWeb()) return setMode("none");
    if (!isStandalone()) {
      if (installDismissed()) return setMode("none");
      if (isIOS()) return setMode("ios-install");
      if (canPromptInstall()) return setMode("install");
      return setMode("none");
    }
    // Installed → nudge notifications if not on yet.
    if (pushSupported()) {
      const ps = await getPushState();
      return setMode(ps === "subscribed" ? "none" : "notify");
    }
    return setMode("none");
  }

  useEffect(() => {
    compute();
  }, []);

  function dismissInstall() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setMode("none");
  }

  async function doInstall() {
    setBusy(true);
    const ok = await promptInstall();
    setBusy(false);
    if (ok) setMode("none");
  }

  async function doNotify() {
    setBusy(true);
    setNote(null);
    const r = await enablePush();
    setBusy(false);
    if (r.ok) setMode("none");
    else setNote(r.error ?? "Couldn't enable reminders.");
  }

  if (mode === "none") return null;

  const content =
    mode === "ios-install"
      ? {
          emoji: "📲",
          title: "Add DaybyDay to your Home Screen",
          body: "Tap the Share button, then “Add to Home Screen” — your daily tip is one tap away, and you can turn on reminders.",
          action: null as null | { label: string; onPress: () => void },
          dismiss: { label: "Got it", onPress: dismissInstall },
        }
      : mode === "install"
        ? {
            emoji: "📲",
            title: "Install DaybyDay",
            body: "Add it to your device for one-tap access and daily reminders.",
            action: { label: busy ? "Installing…" : "Install app", onPress: doInstall },
            dismiss: { label: "Not now", onPress: dismissInstall },
          }
        : {
            emoji: "🔔",
            title: "Never miss a day",
            body: "Get your tip delivered each morning, at a time you choose.",
            action: { label: busy ? "Turning on…" : "Turn on reminders", onPress: doNotify },
            dismiss: { label: "Maybe later", onPress: () => setMode("none") },
          };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: radius.card,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <Text style={{ fontSize: font.title }}>{content.emoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.body,
              fontWeight: "600",
              color: colors.text,
            }}
          >
            {content.title}
          </Text>
          <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 20 }}>
            {content.body}
          </Text>
        </View>
      </View>

      {note ? <Text style={{ fontSize: font.tiny, color: colors.danger }}>{note}</Text> : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.lg,
          marginTop: spacing.xs,
        }}
      >
        {content.action ? (
          <Pressable
            onPress={content.action.onPress}
            disabled={busy}
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.button,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: font.small }}>
              {content.action.label}
            </Text>
          </Pressable>
        ) : null}
        <Text
          onPress={content.dismiss.onPress}
          style={{ color: colors.textMuted, fontSize: font.small }}
        >
          {content.dismiss.label}
        </Text>
      </View>
    </View>
  );
}
