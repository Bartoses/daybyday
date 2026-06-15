import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { FeedCard } from "@daybyday/schemas";
import { Card } from "./ui";
import { colors, font, fonts, radius, spacing, categoryMeta } from "../theme";

const FALLBACK_META = { emoji: "✨", tint: colors.surfaceAlt, ink: colors.textMuted, label: "Tip" };

/** Whether the card has extra depth worth an expandable section. */
function hasMore(card: FeedCard): boolean {
  return Boolean(
    card.signs_of_healthy_development ||
    card.common_misunderstanding ||
    card.when_to_consult_doctor,
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Show the "Parents often wonder" prompt only when it's a genuine question that
 * adds something — not a restatement of the insight (a lot of content repeats it).
 */
function showPrompt(card: FeedCard): boolean {
  const prompt = card.follow_up_prompt?.trim();
  if (!prompt || !prompt.includes("?")) return false;
  const np = normalize(prompt);
  const ni = normalize(card.insight);
  return np !== ni && !np.includes(ni) && !ni.includes(np);
}

/** Show the focus tag only when it reads like a short label, not a sentence. */
function showFocus(card: FeedCard): boolean {
  const f = card.development_focus?.trim();
  return Boolean(f && f.length <= 32 && !f.includes("."));
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
      <Text
        style={{
          fontSize: font.small,
          color: active ? activeColor : colors.textMuted,
          fontWeight: active ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The shared tip reading card — a magazine-style read used by both the daily
 * feed and answered questions. Manages its own expand + feedback display state;
 * pass a new `key` (the tip_id) from the parent to reset when the card changes.
 */
export function TipCard({
  card,
  onFeedback,
  dimmed,
}: {
  card: FeedCard;
  onFeedback?: (helpful: boolean) => void;
  dimmed?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<boolean | null>(null);

  function give(helpful: boolean) {
    setFeedback(helpful);
    onFeedback?.(helpful);
  }

  const meta = categoryMeta[card.category] ?? FALLBACK_META;

  return (
    <Card style={{ gap: spacing.lg, opacity: dimmed ? 0.6 : 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            backgroundColor: meta.tint,
            borderRadius: radius.pill,
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.md,
          }}
        >
          <Text style={{ fontSize: font.small }}>{meta.emoji}</Text>
          <Text
            style={{ fontSize: font.tiny, fontWeight: "700", color: meta.ink, letterSpacing: 0.3 }}
          >
            {meta.label.toUpperCase()}
          </Text>
        </View>
        {card.stage ? (
          <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>{card.stage}</Text>
        ) : null}
      </View>

      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 27,
          fontWeight: "600",
          color: colors.heading,
          lineHeight: 36,
          letterSpacing: -0.2,
        }}
      >
        {card.insight}
      </Text>

      {/* Action — the "do this" block, clearly set apart */}
      <View
        style={{
          backgroundColor: colors.primarySoft,
          borderRadius: radius.card,
          padding: spacing.lg,
          gap: spacing.xs,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Text style={{ fontSize: font.tiny }}>✓</Text>
          <Text
            style={{
              fontSize: font.tiny,
              fontWeight: "800",
              color: colors.primaryPress,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Try this today
          </Text>
        </View>
        <Text style={{ fontSize: font.heading, color: colors.text, lineHeight: 27 }}>
          {card.action_tip}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Text style={{ fontSize: font.heading, lineHeight: 24 }}>💬</Text>
        <Text
          style={{
            flex: 1,
            fontSize: font.body,
            color: colors.textMuted,
            fontStyle: "italic",
            lineHeight: 24,
          }}
        >
          {card.reassurance}
        </Text>
      </View>

      {showPrompt(card) ? (
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
                <LearnMoreRow
                  label="Signs it's going well"
                  body={card.signs_of_healthy_development}
                />
              ) : null}
              {card.common_misunderstanding ? (
                <LearnMoreRow label="A common myth" body={card.common_misunderstanding} />
              ) : null}
              {card.when_to_consult_doctor ? (
                <LearnMoreRow
                  label="When to check with your doctor"
                  body={card.when_to_consult_doctor}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {showFocus(card) ? (
        <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>
          ✦ Supports {card.development_focus}
        </Text>
      ) : null}

      {onFeedback ? (
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
            onPress={() => give(true)}
          />
          <FeedbackChip
            label="Not for us"
            active={feedback === false}
            activeColor={colors.danger}
            onPress={() => give(false)}
          />
        </View>
      ) : null}
    </Card>
  );
}
