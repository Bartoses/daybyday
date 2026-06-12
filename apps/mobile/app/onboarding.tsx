import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError } from "../src/api-client";
import { Button, Field, Screen } from "../src/components/ui";
import { colors, font, spacing } from "../src/theme";

type Step = "parent" | "child" | "focus";

const FOCUS_OPTIONS: Array<{ key: "daily_guidance" | "sleep_support" | "big_feelings"; label: string }> = [
  { key: "daily_guidance", label: "Daily guidance" },
  { key: "sleep_support", label: "Sleep support" },
  { key: "big_feelings", label: "Big feelings" },
];

/** Looks like a date the API will accept (YYYY-MM-DD). */
function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>("parent");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]["key"]>("daily_guidance");
  const [childName, setChildName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setError(null);
    if (!isIsoDate(birthdate)) {
      setError("Please enter the birthdate as YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    try {
      await api.bootstrap({ name: name.trim(), focus_area: focus });
      await api.createChild({ name: childName.trim(), birthdate });
      await api.completeOnboarding();
      router.replace("/today");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xl, maxWidth: 420, width: "100%", alignSelf: "center", flex: 1 }}>
        {step === "parent" && (
          <View style={{ gap: spacing.lg }}>
            <Header title="What should we call you?" subtitle="Your first name is enough." />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" />
            <Button
              title="Continue"
              onPress={() => name.trim() && setStep("child")}
              disabled={!name.trim()}
            />
          </View>
        )}

        {step === "child" && (
          <View style={{ gap: spacing.lg }}>
            <Header title="Tell us about your little one" subtitle="We tailor each day to their age." />
            <Field label="Child's name" value={childName} onChangeText={setChildName} placeholder="Sam" />
            <Field
              label="Birthdate (YYYY-MM-DD)"
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="2026-01-15"
              autoCapitalize="none"
            />
            <Button
              title="Continue"
              onPress={() => childName.trim() && isIsoDate(birthdate) && setStep("focus")}
              disabled={!childName.trim() || !isIsoDate(birthdate)}
            />
          </View>
        )}

        {step === "focus" && (
          <View style={{ gap: spacing.lg }}>
            <Header title="What matters most right now?" subtitle="You can change this anytime." />
            <View style={{ gap: spacing.sm }}>
              {FOCUS_OPTIONS.map((opt) => {
                const selected = focus === opt.key;
                return (
                  <Text
                    key={opt.key}
                    onPress={() => setFocus(opt.key)}
                    style={{
                      padding: spacing.lg,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                      color: colors.text,
                      fontSize: font.body,
                      fontWeight: selected ? "700" : "500",
                      overflow: "hidden",
                    }}
                  >
                    {opt.label}
                  </Text>
                );
              })}
            </View>
            {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}
            <Button title="Start my first day" onPress={finish} loading={busy} />
          </View>
        )}
      </View>
    </Screen>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: font.title, fontWeight: "800", color: colors.text }}>{title}</Text>
      <Text style={{ fontSize: font.body, color: colors.textMuted }}>{subtitle}</Text>
    </View>
  );
}
