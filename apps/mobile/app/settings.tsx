import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import type { MeResponse } from "@daybyday/schemas";
import { api, ApiError } from "../src/api-client";
import { Button, Card, Field, Screen } from "../src/components/ui";
import { DateSelect, EMPTY_DATE, toIsoDate, type DateParts } from "../src/components/form";
import { colors, font, radius, spacing } from "../src/theme";
import { titleCase, formatAge } from "../src/format";

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
  }, []);

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

