import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { FeedCard } from "@daybyday/schemas";
import { Card, Pill } from "./ui";
import { colors, font, radius, spacing, categoryLabels } from "../theme";

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

  return (
    <Card style={{ gap: spacing.lg, opacity: dimmed ? 0.6 : 1 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pill label={categoryLabels[card.category] ?? card.category} />
        {card.stage ? <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>{card.stage}</Text> : null}
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

      <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: spacing.lg, gap: spacing.xs }}>
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
        <Text style={{ fontSize: font.heading, color: colors.text, lineHeight: 27 }}>{card.action_tip}</Text>
      </View>

      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.button, padding: spacing.lg }}>
        <Text style={{ fontSize: font.body, color: colors.text, fontStyle: "italic", lineHeight: 24 }}>
          {card.reassurance}
        </Text>
      </View>

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
        <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>✦ Supports {card.development_focus}</Text>
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
          <FeedbackChip label="♥  Helpful" active={feedback === true} activeColor={colors.success} onPress={() => give(true)} />
          <FeedbackChip label="Not for us" active={feedback === false} activeColor={colors.danger} onPress={() => give(false)} />
        </View>
      ) : null}
    </Card>
  );
}
