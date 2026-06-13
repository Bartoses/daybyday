import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { MeResponse } from "@daybyday/schemas";
import { api, ApiError } from "../src/api-client";
import { Button, Card, Field, Screen } from "../src/components/ui";
import { DateSelect, EMPTY_DATE, toIsoDate, Select, type DateParts } from "../src/components/form";
import { colors, font, radius, spacing, categoryLabels } from "../src/theme";
import { titleCase, formatAge } from "../src/format";
import { enablePush, disablePush, getPushState, pushSupported, type PushState } from "../src/push";

const NOTIF_CATEGORIES = ["sleep", "feeding", "development", "learning_play", "emotional", "behavior", "safety"];
function formatHour(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${period}`;
}
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: formatHour(h) }));

type Child = MeResponse["children"][number];

const FOCUS_OPTIONS = [
  { key: "daily_guidance", label: "Daily guidance" },
  { key: "sleep_support", label: "Sleep support" },
  { key: "big_feelings", label: "Big feelings" },
] as const;

export default function Settings() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Add-child form
  const [adding, setAdding] = useState(false);
  const [cName, setCName] = useState("");
  const [cDate, setCDate] = useState<DateParts>(EMPTY_DATE);
  const [error, setError] = useState<string | null>(null);

  // Notifications
  const [pushState, setPushState] = useState<PushState>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [sendHour, setSendHour] = useState(8);
  const [notifCats, setNotifCats] = useState<string[]>([]);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);

  async function refresh() {
    const m = await api.me();
    setMe(m);
    setName(m.parent.name ?? "");
    setFocus(m.parent.focus_area ?? null);
  }

  useEffect(() => {
    refresh()
      .catch(() => router.replace("/onboarding"))
      .finally(() => setLoading(false));
    getPushState().then(setPushState);
    api
      .getNotifPrefs()
      .then((p) => {
        setSendHour(p.send_hour);
        setNotifCats(p.categories);
      })
      .catch(() => {});
  }, []);

  async function savePrefs() {
    setPrefsBusy(true);
    setPrefsSaved(false);
    try {
      await api.updateNotifPrefs({ daily_enabled: true, send_hour: sendHour, categories: notifCats });
      setPrefsSaved(true);
    } catch {
      /* non-blocking */
    } finally {
      setPrefsBusy(false);
    }
  }

  function toggleCat(c: string) {
    setPrefsSaved(false);
    setNotifCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function toggleNotifications() {
    setPushBusy(true);
    setPushNote(null);
    try {
      if (pushState === "subscribed") {
        await disablePush();
      } else {
        const res = await enablePush();
        if (!res.ok) setPushNote(res.error ?? "Could not enable notifications.");
      }
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTest() {
    setPushBusy(true);
    setPushNote(null);
    try {
      const res = await api.pushTest();
      setPushNote(`Sent to ${res.sent} device${res.sent === 1 ? "" : "s"} — check your notifications.`);
    } catch (e) {
      setPushNote(e instanceof ApiError ? e.message : "Could not send a test.");
    } finally {
      setPushBusy(false);
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileSaved(false);
    try {
      await api.updateProfile({ name: titleCase(name), focus_area: focus ?? undefined });
      setProfileSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function addChild() {
    setError(null);
    const iso = toIsoDate(cDate);
    if (!cName.trim() || !iso) {
      setError("Enter a name and a valid birthdate.");
      return;
    }
    setAdding(true);
    try {
      await api.createChild({ name: titleCase(cName), birthdate: iso });
      setCName("");
      setCDate(EMPTY_DATE);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add child.");
    } finally {
      setAdding(false);
    }
  }

  async function removeChild(c: Child) {
    try {
      await api.deleteChild(c.id);
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove child.");
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
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.xl,
          maxWidth: 600,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: font.title, fontWeight: "800", color: colors.text }}>Settings</Text>
          <Text
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/today"))}
            style={{ color: colors.primary, fontSize: font.small }}
          >
            Done
          </Text>
        </View>

        {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}

        {me?.is_admin ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={{
              borderRadius: radius.button,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.surface,
              padding: spacing.lg,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: font.body, color: colors.primary, fontWeight: "700" }}>
              Admin · Schedule broadcasts
            </Text>
            <Text style={{ color: colors.primary, fontSize: font.body }}>→</Text>
          </Pressable>
        ) : null}

        {/* Profile */}
        <Card style={{ gap: spacing.md }}>
          <Text style={{ fontSize: font.heading, fontWeight: "700", color: colors.text }}>Your profile</Text>
          <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" />
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.textMuted, fontSize: font.small, fontWeight: "600" }}>Focus</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {FOCUS_OPTIONS.map((o) => {
                const active = focus === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => setFocus(o.key)}
                    style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.surfaceAlt : colors.surface,
                    }}
                  >
                    <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? "700" : "500", fontSize: font.small }}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Button title={profileSaved ? "Saved ✓" : "Save profile"} onPress={saveProfile} loading={savingProfile} />
        </Card>

        {/* Notifications */}
        <Card style={{ gap: spacing.md }}>
          <Text style={{ fontSize: font.heading, fontWeight: "700", color: colors.text }}>Daily reminders</Text>
          {!pushSupported() ? (
            <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 20 }}>
              Notifications aren't supported here. On iPhone, add DaybyDay to your Home Screen first
              (Share → Add to Home Screen), then open it from there to enable reminders.
            </Text>
          ) : pushState === "denied" ? (
            <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 20 }}>
              Notifications are blocked in your browser settings. Re-enable them for this site, then refresh.
            </Text>
          ) : (
            <>
              <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 20 }}>
                Get a gentle daily nudge with your tip — so you never miss a day.
              </Text>
              <Button
                title={pushState === "subscribed" ? "Turn off reminders" : "Enable reminders"}
                variant={pushState === "subscribed" ? "secondary" : "primary"}
                onPress={toggleNotifications}
                loading={pushBusy}
              />
              {pushState === "subscribed" ? (
                <Button title="Send a test notification" variant="secondary" onPress={sendTest} loading={pushBusy} />
              ) : null}
            </>
          )}
          {pushNote ? (
            <Text style={{ fontSize: font.small, color: colors.textMuted }}>{pushNote}</Text>
          ) : null}

          {/* Schedule + topic controls (only meaningful once reminders are on) */}
          {pushState === "subscribed" ? (
            <View style={{ gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
              <Select
                label="When should we send it?"
                value={String(sendHour)}
                options={HOUR_OPTIONS}
                onChange={(v) => {
                  setSendHour(Number(v));
                  setPrefsSaved(false);
                }}
              />
              <View style={{ gap: spacing.xs }}>
                <Text style={{ color: colors.textMuted, fontSize: font.small, fontWeight: "600" }}>
                  What it should be about
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: font.tiny }}>
                  Pick topics, or leave all off for a balanced mix.
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
                  {NOTIF_CATEGORIES.map((c) => {
                    const active = notifCats.includes(c);
                    return (
                      <Pressable
                        key={c}
                        onPress={() => toggleCat(c)}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.surfaceAlt : colors.surface,
                        }}
                      >
                        <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? "700" : "500", fontSize: font.small }}>
                          {categoryLabels[c] ?? c}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <Button
                title={prefsSaved ? "Saved ✓" : "Save schedule"}
                variant="secondary"
                onPress={savePrefs}
                loading={prefsBusy}
              />
            </View>
          ) : null}
        </Card>

        {/* Children */}
        <Card style={{ gap: spacing.md }}>
          <Text style={{ fontSize: font.heading, fontWeight: "700", color: colors.text }}>Children</Text>
          {(me?.children ?? []).map((c) => (
            <View
              key={c.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.button,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
              }}
            >
              <Text style={{ fontSize: font.body, fontWeight: "700", color: colors.text }}>
                {titleCase(c.name)}
                <Text style={{ fontWeight: "400", color: colors.textMuted }}>
                  {c.age_days != null ? `  ·  ${formatAge(c.age_days)}` : ""}
                </Text>
              </Text>
              <Text onPress={() => removeChild(c)} style={{ color: colors.danger, fontSize: font.small }}>
                Remove
              </Text>
            </View>
          ))}

          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Text style={{ fontSize: font.small, fontWeight: "700", color: colors.textMuted }}>Add a child</Text>
            <Field label="Child's name" value={cName} onChangeText={setCName} placeholder="Sam" />
            <DateSelect label="Birthdate" value={cDate} onChange={setCDate} />
            <Button title="Add child" variant="secondary" onPress={addChild} loading={adding} />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

