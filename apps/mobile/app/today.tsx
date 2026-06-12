import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { FeedCard, MeResponse, RequestType } from "@daybyday/schemas";
import { api, ApiError } from "../src/api-client";
import { useAuth } from "../src/auth";
import { Button, Card, Screen } from "../src/components/ui";
import { TipCard } from "../src/components/TipCard";
import { colors, font, spacing, radius } from "../src/theme";

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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const children = me?.children ?? [];

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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ fontSize: font.heading, fontWeight: "800", color: colors.text }}>
            {greeting()}
            {me?.parent.name ? `, ${me.parent.name}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Text onPress={() => router.push("/settings")} style={{ color: colors.primary, fontSize: font.small }}>
              Settings
            </Text>
            <Text onPress={signOut} style={{ color: colors.textMuted, fontSize: font.small }}>
              Sign out
            </Text>
          </View>
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
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
                  <Text style={{ color: active ? colors.onPrimary : colors.text, fontWeight: active ? "700" : "500", fontSize: font.small }}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {child ? (
          <Text style={{ fontSize: font.small, color: colors.textMuted, marginTop: -spacing.sm }}>
            {child.name}
            {child.age_days != null ? ` · ${formatAge(child.age_days)}` : ""}
            {child.stage ? ` · ${child.stage.replace(/_/g, " ")}` : ""}
          </Text>
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
              Ask about {child.name}…
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
