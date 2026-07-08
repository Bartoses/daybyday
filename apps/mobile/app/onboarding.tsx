import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { api, ApiError } from "../src/api-client";
import { Button, Field, Screen } from "../src/components/ui";
import { DateSelect, EMPTY_DATE, toIsoDate, type DateParts } from "../src/components/form";
import { colors, font, fonts, radius, spacing } from "../src/theme";
import { titleCase } from "../src/format";
import logoMark from "../assets/logo-mark.png";

type Step = "welcome" | "parent" | "children" | "focus";
const FORM_STEPS: Step[] = ["parent", "children", "focus"];

const FOCUS_OPTIONS: Array<{
  key: "daily_guidance" | "sleep_support" | "big_feelings";
  label: string;
  hint: string;
}> = [
  { key: "daily_guidance", label: "Daily guidance", hint: "A little of everything, every day" },
  { key: "sleep_support", label: "Sleep support", hint: "Naps, nights, and routines" },
  { key: "big_feelings", label: "Big feelings", hint: "Tantrums, emotions, connection" },
];

interface DraftChild {
  name: string;
  iso: string;
}

export default function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<(typeof FOCUS_OPTIONS)[number]["key"]>("daily_guidance");

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
      <View
        style={{
          gap: spacing.xl,
          maxWidth: 440,
          width: "100%",
          alignSelf: "center",
          flex: 1,
          justifyContent: step === "welcome" ? "center" : "flex-start",
        }}
      >
        {step === "welcome" && (
          <View style={{ gap: spacing.xl }}>
            <View style={{ gap: spacing.sm }}>
              <Image source={logoMark} style={{ width: 64, height: 64 }} resizeMode="contain" />
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: font.display,
                  fontWeight: "600",
                  color: colors.text,
                }}
              >
                Welcome to DaybyDay
              </Text>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: font.heading,
                  fontWeight: "500",
                  color: colors.text,
                  lineHeight: 28,
                }}
              >
                One age-perfect parenting tip a day — so you always know the next small thing that
                helps.
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              <ValueRow
                emoji="🌱"
                title="A fresh tip every day"
                body="Bite-sized and matched to your child's exact age and stage."
              />
              <ValueRow
                emoji="💬"
                title="Ask anything, anytime"
                body="Get a real, relevant answer about your child in seconds."
              />
              <ValueRow
                emoji="📈"
                title="It grows with them"
                body="From newborn nights to big-kid feelings — the whole journey."
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Button title="Get started" onPress={() => setStep("parent")} />
              <Text style={{ fontSize: font.tiny, color: colors.textMuted, textAlign: "center" }}>
                Takes about 2 minutes · Free · No spam
              </Text>
              <Text
                onPress={() => router.push({ pathname: "/sign-in", params: { mode: "signin" } })}
                style={{
                  fontSize: font.small,
                  color: colors.primaryPress,
                  fontWeight: "700",
                  textAlign: "center",
                  marginTop: spacing.sm,
                }}
              >
                Already have an account? Log in
              </Text>
            </View>
          </View>
        )}

        {step !== "welcome" && <Progress current={step} />}

        {step === "parent" && (
          <View style={{ gap: spacing.lg }}>
            <Header title="First, what should we call you?" subtitle="Your first name is plenty." />
            <Field label="Your name" value={name} onChangeText={setName} placeholder="Alex" />
            <Button
              title="Continue"
              onPress={() => name.trim() && setStep("children")}
              disabled={!name.trim()}
            />
          </View>
        )}

        {step === "children" && (
          <View style={{ gap: spacing.lg }}>
            <Header
              title="Tell us about your little one"
              subtitle="Their birthdate is how we tailor every tip. Add as many children as you like."
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
                      {c.name}{" "}
                      <Text style={{ fontWeight: "400", color: colors.textMuted }}>· {c.iso}</Text>
                    </Text>
                    <Text
                      onPress={() => removeChild(i)}
                      style={{ color: colors.danger, fontSize: font.small }}
                    >
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

            {error ? (
              <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text>
            ) : null}
            <Button
              title="Continue"
              onPress={continueFromChildren}
              disabled={children.length === 0 && !draftValid}
            />
          </View>
        )}

        {step === "focus" && (
          <View style={{ gap: spacing.lg }}>
            <Header
              title="What matters most right now?"
              subtitle="We'll lean your tips this way. You can change it anytime."
            />
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
                    <Text style={{ color: colors.textMuted, fontSize: font.small }}>
                      {opt.hint}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? (
              <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text>
            ) : null}
            <Button title="Show me today's tip" onPress={finish} loading={busy} />
            <Text style={{ fontSize: font.tiny, color: colors.textMuted, textAlign: "center" }}>
              You'll land on your first daily card — that's your home base every day.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

function Progress({ current }: { current: Step }) {
  const idx = FORM_STEPS.indexOf(current);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontSize: font.tiny, color: colors.textMuted, fontWeight: "600" }}>
        Step {idx + 1} of {FORM_STEPS.length}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {FORM_STEPS.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= idx ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function ValueRow({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
      <Text style={{ fontSize: font.title }}>{emoji}</Text>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: font.body, fontWeight: "700", color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: font.small, color: colors.textMuted, lineHeight: 20 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: font.title,
          fontWeight: "600",
          color: colors.text,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: font.body, color: colors.textMuted }}>{subtitle}</Text>
    </View>
  );
}
