import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { MeResponse } from "@daybyday/schemas";
import { api, ApiError, dayChat, track, type DayMessage } from "../src/api-client";
import { colors, font, fonts, radius, spacing, shadow } from "../src/theme";
import { titleCase } from "../src/format";

type Child = MeResponse["children"][number];

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_PROMPTS = ["Help with naps", "Big reactions", "Won't eat dinner", "Screen time"];

let tmpSeq = 0;
const tmpId = () => `tmp-${Date.now()}-${tmpSeq++}`;

export default function AskDay() {
  const params = useLocalSearchParams<{ child_id?: string; q?: string }>();
  const didAutoSend = useRef(false);
  const [parentName, setParentName] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [child, setChild] = useState<Child | null>(null);
  const [faq, setFaq] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    track("screen_view", { screen: "ask" });
    Promise.all([
      api.me(),
      api.dayHistory().catch(() => ({ messages: [] as DayMessage[], limit: 0 })),
    ])
      .then(async ([m, hist]) => {
        setParentName(m.parent.name ?? "");
        setChildren(m.children);
        const picked = m.children.find((c) => c.id === params.child_id) ?? m.children[0] ?? null;
        setChild(picked);
        setMessages(hist.messages.map((d) => ({ id: d.id, role: d.role, content: d.content })));
        if (picked) {
          try {
            const { questions } = await api.faq(picked.id);
            setFaq(questions.slice(0, 4));
          } catch {
            setFaq([]);
          }
        }
      })
      .catch(() => router.replace("/onboarding"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages, streaming]);

  // Auto-send a question passed in (e.g. "Ask Day about this" from the timeline).
  useEffect(() => {
    if (child && params.q && !didAutoSend.current) {
      didAutoSend.current = true;
      void send(params.q);
    }
  }, [child]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setMessages((m) => [...m, { id: tmpId(), role: "user", content: q }]);
    setInput("");
    setError(null);
    setSending(true);
    setStreaming("");
    try {
      const full = await dayChat(q, child?.id ?? null, (delta) =>
        setStreaming((s) => (s ?? "") + delta),
      );
      setMessages((m) => [...m, { id: tmpId(), role: "assistant", content: full }]);
      setStreaming(null);
    } catch (e) {
      setStreaming(null);
      if (e instanceof ApiError && e.status === 402) {
        setLimitReached(true);
      } else if (e instanceof ApiError && e.status === 503) {
        setError(e.message);
      } else {
        setError("Day had trouble answering. Please try again.");
      }
    } finally {
      setSending(false);
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

  const isEmpty = messages.length === 0 && streaming === null;
  const suggestions = faq.length > 0 ? faq : DEFAULT_PROMPTS;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Day header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            ...shadow,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 24,
              fontWeight: "600",
              color: colors.surfaceAlt,
            }}
          >
            d
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.heading,
              fontWeight: "600",
              color: colors.heading,
            }}
          >
            Day
          </Text>
          <Text style={{ fontSize: font.tiny, color: colors.accent, fontWeight: "700" }}>
            ● Always here
          </Text>
        </View>
        {children.length > 1 ? (
          <ChildSwitcher children={children} child={child} onPick={setChild} />
        ) : null}
        <Text
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))}
          style={{ color: colors.primaryPress, fontSize: font.small, fontWeight: "700" }}
        >
          Done
        </Text>
      </View>

      {/* Conversation */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: spacing.xl,
          gap: spacing.md,
          maxWidth: 640,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {isEmpty ? (
          <View style={{ gap: spacing.lg, paddingTop: spacing.lg }}>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: font.title,
                fontWeight: "500",
                color: colors.heading,
                lineHeight: 32,
              }}
            >
              {parentName ? `Hi ${titleCase(parentName)} — ` : "Hi — "}
              ask me anything{child ? ` about ${titleCase(child.name)}` : ""}.
            </Text>
            <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>
              Try asking
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {suggestions.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => send(q)}
                  style={{
                    backgroundColor: colors.primarySoft,
                    borderRadius: radius.pill,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.lg,
                  }}
                >
                  <Text
                    style={{ color: colors.primaryPress, fontSize: font.small, fontWeight: "600" }}
                  >
                    {q}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}

        {streaming !== null ? (
          streaming === "" ? (
            <TypingBubble />
          ) : (
            <Bubble role="assistant" content={streaming} />
          )
        ) : null}

        {limitReached ? <PaywallNudge /> : null}
        {error ? (
          <Text
            style={{ color: colors.danger, fontSize: font.small, paddingHorizontal: spacing.xs }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {/* Composer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
          maxWidth: 640,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={child ? `Ask about ${titleCase(child.name)}…` : "Ask Day…"}
          placeholderTextColor={colors.textFaint}
          multiline
          onSubmitEditing={() => send(input)}
          editable={!sending}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.inputBorder,
            borderRadius: radius.button,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            fontFamily: fonts.body,
            fontSize: font.body,
            color: colors.text,
            maxHeight: 120,
          }}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={sending || !input.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.button,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: sending || !input.trim() ? 0.5 : 1,
          }}
        >
          {sending ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={{ color: colors.onPrimary, fontSize: 20, fontWeight: "700" }}>↑</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
      {!isUser ? (
        <Text
          style={{
            fontSize: font.tiny,
            fontWeight: "700",
            color: colors.accent,
            marginBottom: 2,
            marginLeft: spacing.xs,
          }}
        >
          Day
        </Text>
      ) : null}
      <View
        style={{
          maxWidth: "88%",
          backgroundColor: isUser ? colors.primarySoft : colors.surfaceAlt,
          borderWidth: isUser ? 0 : 1,
          borderColor: colors.border,
          borderRadius: radius.card,
          borderTopRightRadius: isUser ? spacing.xs : radius.card,
          borderTopLeftRadius: isUser ? radius.card : spacing.xs,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text
          style={{
            fontSize: font.body,
            lineHeight: 24,
            color: isUser ? colors.primaryPress : colors.text,
            fontWeight: isUser ? "600" : "400",
          }}
        >
          {content}
        </Text>
      </View>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={{ alignItems: "flex-start" }}>
      <Text
        style={{
          fontSize: font.tiny,
          fontWeight: "700",
          color: colors.accent,
          marginBottom: 2,
          marginLeft: spacing.xs,
        }}
      >
        Day
      </Text>
      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.card,
          borderTopLeftRadius: spacing.xs,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          gap: spacing.sm,
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={{ color: colors.textMuted, fontSize: font.small, fontStyle: "italic" }}>
          Day is thinking…
        </Text>
      </View>
    </View>
  );
}

function PaywallNudge() {
  return (
    <View
      style={{
        backgroundColor: colors.heading,
        borderRadius: radius.card,
        padding: spacing.xl,
        gap: spacing.sm,
        ...shadow,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: font.heading,
          fontWeight: "600",
          color: colors.surfaceAlt,
        }}
      >
        You've reached today's free messages
      </Text>
      <Text style={{ color: "#C9CEDA", fontSize: font.small, lineHeight: 21 }}>
        Upgrade to Premium for unlimited chats with Day, plus the full meal planner and advanced
        reminders.
      </Text>
      <Pressable
        onPress={() => router.push("/settings")}
        style={{
          marginTop: spacing.sm,
          backgroundColor: colors.primary,
          borderRadius: radius.button,
          paddingVertical: spacing.md,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: "700", fontSize: font.body }}>
          See Premium
        </Text>
      </Pressable>
    </View>
  );
}

function ChildSwitcher({
  children,
  child,
  onPick,
}: {
  children: Child[];
  child: Child | null;
  onPick: (c: Child) => void;
}) {
  // Cycle through children on tap — compact control for the header.
  function next() {
    if (!child) return;
    const i = children.findIndex((c) => c.id === child.id);
    const nextChild = children[(i + 1) % children.length];
    if (nextChild) onPick(nextChild);
  }
  return (
    <Pressable
      onPress={next}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: radius.pill,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={{ color: colors.text, fontSize: font.small, fontWeight: "600" }}>
        {child ? titleCase(child.name) : "Child"} ⇄
      </Text>
    </Pressable>
  );
}
