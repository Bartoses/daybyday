import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError, type Broadcast } from "../src/api-client";
import { Button, Card, Field, Screen } from "../src/components/ui";
import { Select } from "../src/components/form";
import { colors, font, radius, spacing } from "../src/theme";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${period}`;
}
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }));

/** Next 30 days as { value: YYYY-MM-DD, label: friendly }. */
function dayOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    out.push({ value, label });
  }
  return out;
}

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const days = dayOptions();
  const [day, setDay] = useState<string>(days[0]!.value);
  const [hour, setHour] = useState<string>("9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const { broadcasts: list } = await api.adminBroadcasts();
    setBroadcasts(list);
  }

  useEffect(() => {
    api
      .me()
      .then((me) => {
        if (!me.is_admin) {
          router.replace("/today");
          return null;
        }
        return refresh();
      })
      .catch(() => router.replace("/today"))
      .finally(() => setLoading(false));
  }, []);

  async function schedule() {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    // Build an ISO timestamp from the chosen local day + hour.
    const scheduledFor = new Date(`${day}T${pad(Number(hour))}:00:00`).toISOString();
    setBusy(true);
    try {
      await api.createBroadcast({ title: title.trim(), body: body.trim(), url: url.trim() || undefined, scheduled_for: scheduledFor });
      setTitle("");
      setBody("");
      setUrl("");
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not schedule.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    try {
      await api.cancelBroadcast(id);
      await refresh();
    } catch {
      /* ignore */
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
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, maxWidth: 600, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: font.title, fontWeight: "800", color: colors.text }}>Admin · Broadcasts</Text>
          <Text onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))} style={{ color: colors.primary, fontSize: font.small }}>
            Done
          </Text>
        </View>

        {/* Composer */}
        <Card style={{ gap: spacing.md }}>
          <Text style={{ fontSize: font.heading, fontWeight: "700", color: colors.text }}>Schedule a message</Text>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="A note from DaybyDay" />
          <Field label="Message" value={body} onChangeText={setBody} placeholder="What do you want to say?" multiline />
          <Field label="Link (optional)" value={url} onChangeText={setUrl} placeholder="https://… (leave blank to open the app)" autoCapitalize="none" />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1.4 }}>
              <Select label="Day" value={day} options={days} onChange={setDay} />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Time" value={hour} options={HOURS} onChange={setHour} />
            </View>
          </View>
          {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}
          <Button title="Schedule broadcast" onPress={schedule} loading={busy} />
          <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>
            Sends to everyone with notifications on, at the chosen time (your timezone). Fires within the hour.
          </Text>
        </Card>

        {/* List */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>Scheduled & recent</Text>
          {broadcasts.length === 0 ? (
            <Text style={{ fontSize: font.small, color: colors.textMuted }}>Nothing yet.</Text>
          ) : (
            broadcasts.map((b) => (
              <Card key={b.id} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: font.body, fontWeight: "700", color: colors.text }}>{b.title}</Text>
                  <StatusPill status={b.status} />
                </View>
                <Text style={{ fontSize: font.small, color: colors.textMuted }}>{b.body}</Text>
                <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>
                  {new Date(b.scheduled_for).toLocaleString()}
                  {b.status === "sent" && b.sent_count != null ? `  ·  sent to ${b.sent_count}` : ""}
                </Text>
                {b.status === "scheduled" ? (
                  <Text onPress={() => cancel(b.id)} style={{ color: colors.danger, fontSize: font.small, marginTop: 2 }}>
                    Cancel
                  </Text>
                ) : null}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatusPill({ status }: { status: Broadcast["status"] }) {
  const color = status === "sent" ? colors.success : status === "canceled" ? colors.textMuted : colors.accent;
  return (
    <View style={{ borderRadius: radius.pill, borderWidth: 1, borderColor: color, paddingVertical: 2, paddingHorizontal: spacing.md }}>
      <Text style={{ fontSize: font.tiny, color, fontWeight: "700" }}>{status}</Text>
    </View>
  );
}
