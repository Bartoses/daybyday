import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { FeedCard, MeResponse, RequestType } from "@daybyday/schemas";
import { api, ApiError } from "../src/api-client";
import { useAuth } from "../src/auth";
import { Button, Card, Pill, Screen } from "../src/components/ui";
import { colors, font, spacing, radius, categoryLabels } from "../src/theme";

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
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const loadCard = useCallback(async (c: Child) => {
    setError(null);
    try {
      setCard(await api.feedToday(c.id));
      setFeedback(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load today's card.");
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then(async (m) => {
        setMe(m);
        const first = m.children[0] ?? null;
        setChild(first);
        if (first) await loadCard(first);
      })
      .catch(() => router.replace("/onboarding"))
      .finally(() => setLoading(false));
  }, [loadCard]);

  async function quick(requestType: RequestType) {
    if (!child) return;
    setActionBusy(true);
    setError(null);
    try {
      setCard(await api.quickAction(child.id, requestType));
      setFeedback(null);
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
    setFeedback(helpful);
    try {
      await api.feedback(card.tip_id, child.id, helpful);
    } catch {
      /* non-blocking */
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: font.heading, fontWeight: "800", color: colors.text }}>
              {greeting()}{me?.parent.name ? `, ${me.parent.name}` : ""}
            </Text>
            {child ? (
              <Text style={{ fontSize: font.small, color: colors.textMuted }}>
                {child.name}
                {child.age_days != null ? ` · ${formatAge(child.age_days)}` : ""}
                {child.stage ? ` · ${child.stage.replace(/_/g, " ")}` : ""}
              </Text>
            ) : null}
          </View>
          <Text onPress={signOut} style={{ color: colors.primary, fontSize: font.small }}>
            Sign out
          </Text>
        </View>

        {error ? (
          <Card style={{ borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontSize: font.body }}>{error}</Text>
          </Card>
        ) : null}

        {card ? (
          <Card style={{ gap: spacing.md }}>
            <Pill label={categoryLabels[card.category] ?? card.category} />
            <Text style={{ fontSize: font.title, fontWeight: "800", color: colors.text, lineHeight: 30 }}>
              {card.insight}
            </Text>
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.primary }}>
                Try this today
              </Text>
              <Text style={{ fontSize: font.body, color: colors.text, lineHeight: 24 }}>
                {card.action_tip}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.button,
                padding: spacing.md,
              }}
            >
              <Text style={{ fontSize: font.body, color: colors.textMuted, fontStyle: "italic" }}>
                {card.reassurance}
              </Text>
            </View>
            {card.when_to_consult_doctor ? (
              <Text style={{ fontSize: font.small, color: colors.textMuted }}>
                ⚕︎ {card.when_to_consult_doctor}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <Text
                onPress={() => sendFeedback(true)}
                style={{ fontSize: font.small, color: feedback === true ? colors.success : colors.textMuted }}
              >
                ♥ Helpful
              </Text>
              <Text
                onPress={() => sendFeedback(false)}
                style={{ fontSize: font.small, color: feedback === false ? colors.danger : colors.textMuted }}
              >
                Not for us
              </Text>
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.textMuted }}>
              No content available yet. Import the knowledge content to populate the feed.
            </Text>
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>
            Need something specific?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {QUICK_ACTIONS.map((a) => (
              <View key={a.key} style={{ flexGrow: 1, minWidth: 96 }}>
                <Button title={a.label} variant="secondary" onPress={() => quick(a.key)} disabled={actionBusy} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatAge(days: number): string {
  if (days < 60) return `${days} days`;
  const months = Math.floor(days / 30.4);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} yr`;
}
