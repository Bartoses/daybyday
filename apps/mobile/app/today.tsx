import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { FeedCard, MeResponse, RequestType } from "@daybyday/schemas";
import { api, ApiError, track, deviceTimezone, type Progress } from "../src/api-client";
import { useAuth } from "../src/auth";
import { Button, Card, Screen } from "../src/components/ui";
import { TipCard } from "../src/components/TipCard";
import { GrowthPrompt } from "../src/components/GrowthPrompt";
import { colors, font, fonts, spacing, radius } from "../src/theme";
import { titleCase, greeting, formatAge, contextualMoment } from "../src/format";

type Child = MeResponse["children"][number];

const QUICK_ACTIONS: Array<{ key: RequestType; label: string }> = [
  { key: "another_tip", label: "Another" },
  { key: "sleep", label: "Sleep" },
  { key: "play", label: "Play" },
  { key: "feeding", label: "Feeding" },
  { key: "behavior", label: "Behavior" },
];

export default function Today() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [child, setChild] = useState<Child | null>(null);
  const [card, setCard] = useState<FeedCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardLoading, setCardLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const loadCard = useCallback(async (c: Child) => {
    setError(null);
    setCardLoading(true);
    try {
      setCard(await api.feedToday(c.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load today's card.");
    } finally {
      setCardLoading(false);
    }
  }, []);

  useEffect(() => {
    track("screen_view", { screen: "today" });
    api
      .me()
      .then(async (m) => {
        setMe(m);
        // Keep the parent's timezone in sync with the device so daily pushes fire
        // at their real local send-hour (handles moves/travel; fixes the old
        // hardcoded "America/Denver" default for non-Denver users).
        const tz = deviceTimezone();
        if (tz && m.parent.timezone !== tz) api.updateProfile({ timezone: tz }).catch(() => {});
        const first = m.children[0] ?? null;
        setChild(first);
        if (first) await loadCard(first);
        // After today's card is logged, refresh streak/progress (reflects seen-today).
        api
          .progress()
          .then(setProgress)
          .catch(() => {});
      })
      .catch((e) => {
        // Only onboard on a real "no account" 404; transient errors keep the
        // signed-in user here instead of bouncing them to the Welcome screen.
        if (e instanceof ApiError && e.status === 404) router.replace("/onboarding");
        else setError("Couldn't reach DaybyDay. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
  }, [loadCard]);

  function switchChild(c: Child) {
    if (c.id === child?.id) return;
    setChild(c);
    setCard(null);
    loadCard(c);
  }

  async function quick(requestType: RequestType) {
    if (!child) return;
    setActionBusy(true);
    setError(null);
    try {
      setCard(await api.quickAction(child.id, requestType));
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setError("You've reached today's free tips. Upgrade for unlimited.");
      } else {
        setError(e instanceof ApiError ? e.message : "Could not load a tip.");
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function sendFeedback(helpful: boolean) {
    if (!card || !child) return;
    try {
      await api.feedback(card.tip_id, child.id, helpful);
    } catch {
      /* non-blocking */
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const children = me?.children ?? [];
  const moment = child ? contextualMoment(child.birthdate, child.name) : null;

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          maxWidth: 600,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.title,
              fontWeight: "600",
              color: colors.text,
            }}
          >
            {greeting()}
            {me?.parent.name ? `, ${titleCase(me.parent.name)}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Text
              onPress={() => router.push("/settings")}
              style={{ color: colors.primary, fontSize: font.small }}
            >
              Settings
            </Text>
            <Text
              onPress={async () => {
                await signOut();
                router.replace("/sign-in");
              }}
              style={{ color: colors.textMuted, fontSize: font.small }}
            >
              Sign out
            </Text>
          </View>
        </View>

        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {children.map((c) => {
              const active = c.id === child?.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => switchChild(c)}
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.text,
                      fontWeight: active ? "700" : "500",
                      fontSize: font.small,
                    }}
                  >
                    {titleCase(c.name)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {progress ? <StreakBar progress={progress} /> : null}

        {child ? (
          <Text style={{ fontSize: font.small, color: colors.textMuted, marginTop: -spacing.sm }}>
            {titleCase(child.name)}
            {child.age_days != null ? ` · ${formatAge(child.age_days)}` : ""}
            {child.stage ? ` · ${child.stage.replace(/_/g, " ")}` : ""}
          </Text>
        ) : null}

        {/* Time-aware moment: birthday, monthly milestone, or seasonal note */}
        {moment ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              alignItems: "center",
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.button,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Text style={{ fontSize: font.heading }}>{moment.emoji}</Text>
            <Text style={{ flex: 1, fontSize: font.small, color: colors.text, lineHeight: 20 }}>
              {moment.text}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontSize: font.body }}>{error}</Text>
          </Card>
        ) : null}

        {cardLoading && !card ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
            <ActivityIndicator color={colors.primary} />
          </Card>
        ) : card ? (
          <TipCard key={card.tip_id} card={card} onFeedback={sendFeedback} dimmed={cardLoading} />
        ) : (
          <Card>
            <Text style={{ color: colors.textMuted }}>No tip available for this age yet.</Text>
          </Card>
        )}

        {/* Feature discovery — rotating, dismissible, deep-links into a feature */}
        {child ? <FeatureNudge child={child} /> : null}

        {/* Install / notifications nudge — shown after the value (the card) */}
        <GrowthPrompt />

        {/* Ask a question */}
        {child ? (
          <Pressable
            onPress={() => router.push({ pathname: "/ask", params: { child_id: child.id } })}
            style={{
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: font.body, color: colors.text, fontWeight: "600" }}>
              Ask about {titleCase(child.name)}…
            </Text>
            <Text style={{ color: colors.primary, fontSize: font.body }}>→</Text>
          </Pressable>
        ) : null}

        {/* Milestones timeline */}
        {child ? (
          <Pressable
            onPress={() => router.push({ pathname: "/timeline", params: { child_id: child.id } })}
            style={{
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: font.body, color: colors.text, fontWeight: "600" }}>
              {titleCase(child.name)}'s milestones
            </Text>
            <Text style={{ color: colors.primary, fontSize: font.body }}>→</Text>
          </Pressable>
        ) : null}

        {/* Quick actions */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>
            Need something specific?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {QUICK_ACTIONS.map((a) => (
              <View key={a.key} style={{ flexGrow: 1, minWidth: 96 }}>
                <Button
                  title={a.label}
                  variant="secondary"
                  onPress={() => quick(a.key)}
                  disabled={actionBusy}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/** Habit-loop reward: streak + tips-learned. Warm, compact, non-naggy. */
function StreakBar({ progress }: { progress: Progress }) {
  const { current_streak, tips_learned, seen_today } = progress;
  const headline =
    current_streak >= 2
      ? `🔥 ${current_streak}-day streak`
      : seen_today
        ? "🔥 Streak started"
        : "👋 Come back daily to build a streak";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: colors.primarySoft,
        borderRadius: radius.button,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text style={{ fontSize: font.body, fontWeight: "700", color: colors.primaryPress }}>
        {headline}
      </Text>
      {tips_learned > 0 ? (
        <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.primaryPress }}>
          {tips_learned} {tips_learned === 1 ? "tip" : "tips"} learned
        </Text>
      ) : null}
    </View>
  );
}

/** Today's date key (UTC) for once-a-day nudge dismissal. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function nudgeDismissedToday(): boolean {
  try {
    return globalThis.localStorage?.getItem("nudge_dismissed") === todayKey();
  } catch {
    return false;
  }
}
function dismissNudgeToday(): void {
  try {
    globalThis.localStorage?.setItem("nudge_dismissed", todayKey());
  } catch {
    /* native / no storage — session dismissal only */
  }
}

/**
 * Rotating, dismissible feature callout — surfaces a feature the daily card alone
 * wouldn't (Ask Day, the milestones timeline). One per day, deep-links in.
 */
function FeatureNudge({ child }: { child: Child }) {
  const name = titleCase(child.name);
  const nudges = [
    {
      feature: "ask",
      emoji: "💬",
      text: `Stuck on something with ${name}? Ask Day for a real answer in seconds.`,
      go: () => router.push({ pathname: "/ask", params: { child_id: child.id } }),
    },
    {
      feature: "timeline",
      emoji: "📈",
      text: `See what's ahead for ${name} — milestones from solids to first words.`,
      go: () => router.push({ pathname: "/timeline", params: { child_id: child.id } }),
    },
  ];
  // Rotate by day so it varies without tracking per-user state.
  const dayNum = Math.floor(Date.now() / 86400000);
  const nudge = nudges[dayNum % nudges.length]!;

  const [hidden, setHidden] = useState(() => nudgeDismissedToday());
  useEffect(() => {
    if (!hidden) track("nudge_shown", { feature: nudge.feature });
  }, [hidden, nudge.feature]);

  if (hidden) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        backgroundColor: colors.accentSoft,
        borderRadius: radius.button,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
      }}
    >
      <Text style={{ fontSize: font.heading }}>{nudge.emoji}</Text>
      <Pressable
        style={{ flex: 1 }}
        onPress={() => {
          track("nudge_tap", { feature: nudge.feature });
          nudge.go();
        }}
      >
        <Text
          style={{ fontSize: font.small, color: colors.text, lineHeight: 20, fontWeight: "600" }}
        >
          {nudge.text}
        </Text>
        <Text
          style={{
            fontSize: font.small,
            color: colors.primaryPress,
            fontWeight: "700",
            marginTop: 2,
          }}
        >
          Try it →
        </Text>
      </Pressable>
      <Text
        onPress={() => {
          dismissNudgeToday();
          setHidden(true);
        }}
        style={{ fontSize: font.heading, color: colors.textFaint, paddingHorizontal: spacing.xs }}
      >
        ×
      </Text>
    </View>
  );
}
