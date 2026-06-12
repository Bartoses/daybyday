import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { FeedCard, MeResponse } from "@daybyday/schemas";
import { api, ApiError } from "../src/api-client";
import { Button, Card, Field, Screen } from "../src/components/ui";
import { TipCard } from "../src/components/TipCard";
import { colors, font, radius, spacing } from "../src/theme";

type Child = MeResponse["children"][number];

export default function Ask() {
  const params = useLocalSearchParams<{ child_id?: string }>();
  const [children, setChildren] = useState<Child[]>([]);
  const [child, setChild] = useState<Child | null>(null);
  const [faq, setFaq] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<FeedCard | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFaq(c: Child) {
    try {
      const { questions } = await api.faq(c.id);
      setFaq(questions);
    } catch {
      setFaq([]);
    }
  }

  useEffect(() => {
    api
      .me()
      .then(async (m) => {
        setChildren(m.children);
        const picked = m.children.find((c) => c.id === params.child_id) ?? m.children[0] ?? null;
        setChild(picked);
        if (picked) await loadFaq(picked);
      })
      .catch(() => router.replace("/onboarding"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(text: string) {
    const q = text.trim();
    if (!q || !child) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    setNoMatch(false);
    setAsked(q);
    try {
      const res = await api.ask(child.id, q);
      setAnswer(res.answer);
      setNoMatch(!res.matched);
      setQuestion("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not send your question.");
    } finally {
      setBusy(false);
    }
  }

  function switchChild(c: Child) {
    if (c.id === child?.id) return;
    setChild(c);
    setAnswer(null);
    setAsked(null);
    setNoMatch(false);
    loadFaq(c);
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
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, maxWidth: 600, width: "100%", alignSelf: "center" }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: font.title, fontWeight: "800", color: colors.text }}>
            Ask{child ? ` about ${child.name}` : ""}
          </Text>
          <Text
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))}
            style={{ color: colors.primary, fontSize: font.small }}
          >
            Done
          </Text>
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

        <View style={{ gap: spacing.md }}>
          <Field
            label="Your question"
            value={question}
            onChangeText={setQuestion}
            placeholder="Why is bedtime such a struggle lately?"
            multiline
            onSubmitEditing={() => submit(question)}
          />
          <Button title="Ask" onPress={() => submit(question)} loading={busy} disabled={!question.trim()} />
        </View>

        {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}

        {/* Answer */}
        {asked ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: font.small, color: colors.textMuted }}>You asked: “{asked}”</Text>
            {busy ? (
              <Card style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
                <ActivityIndicator color={colors.primary} />
              </Card>
            ) : answer ? (
              <TipCard key={answer.tip_id} card={answer} />
            ) : noMatch ? (
              <Card>
                <Text style={{ fontSize: font.body, color: colors.text, lineHeight: 23 }}>
                  We've saved your question. We don't have a perfect match yet, but your
                  daily tips will keep adapting to {child?.name ?? "your child"}.
                </Text>
              </Card>
            ) : null}
          </View>
        ) : null}

        {/* FAQ chips */}
        {faq.length > 0 && !asked ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>
              Common questions at this age
            </Text>
            <View style={{ gap: spacing.sm }}>
              {faq.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => submit(q)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    borderRadius: radius.button,
                    padding: spacing.lg,
                  }}
                >
                  <Text style={{ fontSize: font.body, color: colors.text, lineHeight: 22 }}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
