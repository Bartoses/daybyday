import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError } from "../src/api-client";
import { Button, Field, Screen } from "../src/components/ui";
import { DateSelect, EMPTY_DATE, toIsoDate, type DateParts } from "../src/components/form";
import { colors, font, radius, spacing } from "../src/theme";
import { titleCase } from "../src/format";

type Step = "parent" | "children" | "focus";

const FOCUS_OPTIONS: Array<{ key: "daily_guidance" | "sleep_support" | "big_feelings"; label: string; hint: string }> = [
  { key: "daily_guidance", label: "Daily guidance", hint: "A little of everything, every day" },
  { key: "sleep_support", label: "Sleep support", hint: "Naps, nights, and routines" },
  { key: "big_feelings", label: "Big feelings", hint: "Tantrums, emotions, connection" },
];

interface DraftChild {
  name: string;
  iso: string;
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>("parent");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]["key"]>("daily_guidance");

  // Multi-child: a confirmed list plus the in-progress draft.
  const [children, setChildren] = useState<DraftChild[]>([]);
  const [cName, setCName] = useState("");
  const [cDate, setCDate] = useState<DateParts>(EMPTY_DATE);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const draftIso = toIsoDate(cDate);
  const draftValid = cName.trim().length > 0 && draftIso !== null;

  function addDraft(): DraftChild[] {
    if (!draftValid || !draftIso) return children;
    const next = [...children, { name: titleCase(cName), iso: draftIso }];
    setChildren(next);
    setCName("");
    setCDate(EMPTY_DATE);
    return next;
  }

  function removeChild(i: number) {
    setChildren(children.filter((_, idx) => idx !== i));
  }

  function continueFromChildren() {
    // Fold the current draft in (if filled), then require at least one child.
    const list = draftValid ? addDraft() : children;
    if (list.length === 0) {
      setError("Add at least one child to continue.");
      return;
    }
    setError(null);
    setStep("focus");
  }

  async function finish() {
    setError(null);
    const list = draftValid ? addDraft() : children;
    if (list.length === 0) {
      setError("Add at least one child first.");
      setStep("children");
      return;
    }
    setBusy(true);
    try {
      await api.bootstrap({ name: titleCase(name), focus_area: focus });
      for (const child of list) {
        await api.createChild({ name: titleCase(child.name), birthdate: child.iso });
      }
      await api.completeOnboarding();
      router.replace("/today");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xl, maxWidth: 440, width: "100%", alignSelf: "center", flex: 1 }}>
        {step === "parent" && (
          <View style={{ gap: spacing.lg }}>
            <Header title="What should we call you?" subtitle="Your first name is enough." />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" />
            <Button title="Continue" onPress={() => name.trim() && setStep("children")} disabled={!name.trim()} />
          </View>
        )}

        {step === "children" && (
          <View style={{ gap: spacing.lg }}>
            <Header
              title="Tell us about your little one"
              subtitle="We tailor each day to their age. Add as many children as you like."
            />

            {children.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                {children.map((c, i) => (
                  <View
                    key={`${c.name}-${i}`}
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
                      {c.name} <Text style={{ fontWeight: "400", color: colors.textMuted }}>· {c.iso}</Text>
                    </Text>
                    <Text onPress={() => removeChild(i)} style={{ color: colors.danger, fontSize: font.small }}>
                      Remove
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ gap: spacing.md }}>
              <Field label="Child's name" value={cName} onChangeText={setCName} placeholder="Sam" />
              <DateSelect label="Birthdate" value={cDate} onChange={setCDate} />
            </View>

            <Pressable onPress={addDraft} disabled={!draftValid}>
              <Text
                style={{
                  color: draftValid ? colors.primary : colors.textMuted,
                  fontSize: font.small,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                + Add another child
              </Text>
            </Pressable>

            {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}
            <Button
              title="Continue"
              onPress={continueFromChildren}
              disabled={children.length === 0 && !draftValid}
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
                  <Pressable
                    key={opt.key}
                    onPress={() => setFocus(opt.key)}
                    style={{
                      padding: spacing.lg,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: font.body,
                        fontWeight: selected ? "700" : "600",
                      }}
                    >
                      {opt.label}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: font.small }}>{opt.hint}</Text>
                  </Pressable>
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
