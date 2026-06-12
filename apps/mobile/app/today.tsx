import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
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
  const [cardLoading, setCardLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadCard = useCallback(async (c: Child) => {
    setError(null);
    setCardLoading(true);
    try {
      setCard(await api.feedToday(c.id));
      setFeedback(null);
      setExpanded(false);
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
      setFeedback(null);
      setExpanded(false);
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
        {/* Header */}
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

        {/* Child switcher (only when more than one) */}
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
                  <Text
                    style={{
                      color: active ? colors.onPrimary : colors.text,
                      fontWeight: active ? "700" : "500",
                      fontSize: font.small,
                    }}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Active child context line */}
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
          <Card style={{ gap: spacing.lg, opacity: cardLoading ? 0.6 : 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pill label={categoryLabels[card.category] ?? card.category} />
              {card.stage ? (
                <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>{card.stage}</Text>
              ) : null}
            </View>

            <Text
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: colors.text,
                lineHeight: 34,
                letterSpacing: -0.3,
              }}
            >
              {card.insight}
            </Text>

            {/* Action block — accented so the "do this" stands out */}
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.primary,
                paddingLeft: spacing.lg,
                gap: spacing.xs,
              }}
            >
              <Text
                style={{
                  fontSize: font.tiny,
                  fontWeight: "800",
                  color: colors.primary,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                Try this today
              </Text>
              <Text style={{ fontSize: font.heading, color: colors.text, lineHeight: 27 }}>
                {card.action_tip}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.button,
                padding: spacing.lg,
              }}
            >
              <Text style={{ fontSize: font.body, color: colors.text, fontStyle: "italic", lineHeight: 24 }}>
                {card.reassurance}
              </Text>
            </View>

            {/* Reflective prompt — universal, conversational, teases the assistant */}
            {card.follow_up_prompt ? (
              <View style={{ gap: spacing.xs }}>
                <Text
                  style={{
                    fontSize: font.tiny,
                    fontWeight: "800",
                    color: colors.accent,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  Parents often wonder
                </Text>
                <Text style={{ fontSize: font.body, color: colors.text, lineHeight: 23 }}>
                  “{card.follow_up_prompt}”
                </Text>
              </View>
            ) : null}

            {/* Expandable "Learn more" — only when there's extra depth to reveal */}
            {hasMore(card) ? (
              <View style={{ gap: spacing.sm }}>
                <Pressable onPress={() => setExpanded((v) => !v)}>
                  <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.primary }}>
                    {expanded ? "Show less" : "Learn more"}
                  </Text>
                </Pressable>
                {expanded ? (
                  <View style={{ gap: spacing.md }}>
                    {card.signs_of_healthy_development ? (
                      <LearnMoreRow label="Signs it's going well" body={card.signs_of_healthy_development} />
                    ) : null}
                    {card.common_misunderstanding ? (
                      <LearnMoreRow label="A common myth" body={card.common_misunderstanding} />
                    ) : null}
                    {card.when_to_consult_doctor ? (
                      <LearnMoreRow label="When to check with your doctor" body={card.when_to_consult_doctor} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {card.development_focus ? (
              <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>
                ✦ Supports {card.development_focus}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                marginTop: spacing.xs,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingTop: spacing.md,
              }}
            >
              <FeedbackChip
                label="♥  Helpful"
                active={feedback === true}
                activeColor={colors.success}
                onPress={() => sendFeedback(true)}
              />
              <FeedbackChip
                label="Not for us"
                active={feedback === false}
                activeColor={colors.danger}
                onPress={() => sendFeedback(false)}
              />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={{ color: colors.textMuted }}>No tip available for this age yet.</Text>
          </Card>
        )}

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

/** Whether the card has extra depth worth an expandable section. */
function hasMore(card: FeedCard): boolean {
  return Boolean(
    card.signs_of_healthy_development || card.common_misunderstanding || card.when_to_consult_doctor,
  );
}

function LearnMoreRow({ label, body }: { label: string; body: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 21 }}>{body}</Text>
    </View>
  );
}

function FeedbackChip({
  label,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? activeColor : colors.border,
        backgroundColor: active ? colors.surfaceAlt : "transparent",
      }}
    >
      <Text style={{ fontSize: font.small, color: active ? activeColor : colors.textMuted, fontWeight: active ? "700" : "500" }}>
        {label}
      </Text>
    </Pressable>
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
