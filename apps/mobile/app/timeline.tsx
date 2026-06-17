import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { MeResponse } from "@daybyday/schemas";
import { api, track, type MilestoneItem } from "../src/api-client";
import { colors, font, fonts, radius, spacing, categoryMeta } from "../src/theme";
import { titleCase } from "../src/format";

type Child = MeResponse["children"][number];

const FALLBACK_META = {
  emoji: "✨",
  tint: colors.surfaceAlt,
  ink: colors.textMuted,
  label: "Milestone",
};

export default function Timeline() {
  const params = useLocalSearchParams<{ child_id?: string }>();
  const [children, setChildren] = useState<Child[]>([]);
  const [child, setChild] = useState<Child | null>(null);
  const [items, setItems] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function loadTimeline(c: Child) {
    try {
      const { milestones } = await api.milestones(c.id);
      setItems(milestones);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    track("screen_view", { screen: "timeline" });
    api
      .me()
      .then(async (m) => {
        setChildren(m.children);
        const picked = m.children.find((c) => c.id === params.child_id) ?? m.children[0] ?? null;
        setChild(picked);
        if (picked) await loadTimeline(picked);
      })
      .catch(() => router.replace("/onboarding"))
      .finally(() => setLoading(false));
  }, []);

  function switchChild(c: Child) {
    if (c.id === child?.id) return;
    setChild(c);
    setItems([]);
    loadTimeline(c);
  }

  async function toggleDone(m: MilestoneItem) {
    if (!child || busyKey) return;
    setBusyKey(m.key);
    const markingDone = m.status !== "done";
    // Optimistic update.
    setItems((prev) =>
      prev.map((x) =>
        x.key === m.key
          ? {
              ...x,
              status: markingDone ? "done" : x.age_months <= 0 ? "now" : "upcoming",
              achieved_on: markingDone ? "today" : null,
            }
          : x,
      ),
    );
    try {
      if (markingDone) await api.achieveMilestone(m.key, child.id);
      else await api.unachieveMilestone(m.key, child.id);
      await loadTimeline(child); // resync true status
    } catch {
      await loadTimeline(child);
    } finally {
      setBusyKey(null);
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

  const now = items.filter((m) => m.status === "now");
  const upcoming = items.filter((m) => m.status === "upcoming");
  const earlier = items.filter((m) => m.status === "done" || m.status === "past");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        maxWidth: 640,
        width: "100%",
        alignSelf: "center",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: font.title,
            fontWeight: "600",
            color: colors.heading,
          }}
        >
          {child ? `${titleCase(child.name)}'s milestones` : "Milestones"}
        </Text>
        <Text
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))}
          style={{ color: colors.primaryPress, fontSize: font.small, fontWeight: "700" }}
        >
          Done
        </Text>
      </View>

      {children.length > 1 ? (
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
                  borderColor: active ? colors.primary : colors.inputBorder,
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
      ) : null}

      <Text style={{ fontSize: font.tiny, color: colors.textFaint, lineHeight: 18 }}>
        Every child grows at their own pace — these are general "around when" guides, not a
        checklist. For any concern, check with your pediatrician.
      </Text>

      <Section
        title="Right around now"
        items={now}
        childId={child?.id}
        busyKey={busyKey}
        onToggle={toggleDone}
        emptyHint="Nothing in this window — peek at what's coming up."
      />
      <Section
        title="Coming up"
        items={upcoming}
        childId={child?.id}
        busyKey={busyKey}
        onToggle={toggleDone}
      />
      <Section
        title="Earlier"
        items={earlier}
        childId={child?.id}
        busyKey={busyKey}
        onToggle={toggleDone}
      />
    </ScrollView>
  );
}

function Section({
  title,
  items,
  childId,
  busyKey,
  onToggle,
  emptyHint,
}: {
  title: string;
  items: MilestoneItem[];
  childId?: string;
  busyKey: string | null;
  onToggle: (m: MilestoneItem) => void;
  emptyHint?: string;
}) {
  if (items.length === 0 && !emptyHint) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={{
          fontSize: font.tiny,
          fontWeight: "800",
          color: colors.textMuted,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      {items.length === 0 ? (
        <Text style={{ fontSize: font.small, color: colors.textFaint }}>{emptyHint}</Text>
      ) : (
        items.map((m) => (
          <MilestoneCard
            key={m.key}
            m={m}
            childId={childId}
            busy={busyKey === m.key}
            onToggle={onToggle}
          />
        ))
      )}
    </View>
  );
}

function MilestoneCard({
  m,
  childId,
  busy,
  onToggle,
}: {
  m: MilestoneItem;
  childId?: string;
  busy: boolean;
  onToggle: (m: MilestoneItem) => void;
}) {
  const meta = categoryMeta[m.category] ?? FALLBACK_META;
  const done = m.status === "done";
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: m.status === "now" ? colors.primary : colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
        opacity: done ? 0.75 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable
          onPress={() => onToggle(m)}
          disabled={busy}
          hitSlop={8}
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: done ? colors.accent : colors.inputBorder,
            backgroundColor: done ? colors.accent : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={done ? colors.onPrimary : colors.accent} />
          ) : done ? (
            <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: "800" }}>✓</Text>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.heading,
              fontWeight: "600",
              color: colors.heading,
            }}
          >
            {m.label}
          </Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 2 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: meta.tint,
                borderRadius: radius.pill,
                paddingVertical: 2,
                paddingHorizontal: spacing.sm,
              }}
            >
              <Text style={{ fontSize: font.tiny }}>{meta.emoji}</Text>
              <Text style={{ fontSize: font.tiny, fontWeight: "700", color: meta.ink }}>
                {meta.label}
              </Text>
            </View>
            <Text style={{ fontSize: font.tiny, color: colors.textFaint }}>{m.age_label}</Text>
          </View>
        </View>
      </View>

      <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 21 }}>
        {m.description}
      </Text>

      <Pressable
        onPress={() =>
          router.push({ pathname: "/ask", params: { child_id: childId ?? "", q: m.ask_prompt } })
        }
      >
        <Text style={{ fontSize: font.small, color: colors.primaryPress, fontWeight: "700" }}>
          💬 Ask Day about this
        </Text>
      </Pressable>
    </View>
  );
}
