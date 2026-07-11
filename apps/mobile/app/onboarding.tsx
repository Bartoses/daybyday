import { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { api, ApiError } from "../src/api-client";
import { useAuth } from "../src/auth";
import { Button, Field, Screen } from "../src/components/ui";
import { DateSelect, EMPTY_DATE, toIsoDate, type DateParts } from "../src/components/form";
import { colors, font, fonts, radius, spacing } from "../src/theme";
import { titleCase } from "../src/format";
import logoMark from "../assets/logo-mark.png";

type Step = "welcome" | "parent" | "children" | "focus";
const STEP_ORDER: Step[] = ["welcome", "parent", "children", "focus"];
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
  const { session } = useAuth();
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

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    const prev = idx > 0 ? STEP_ORDER[idx - 1] : undefined;
    if (prev) setStep(prev);
  }

  function handleGetStarted() {
    // No account yet (e.g. this screen was opened directly, skipping sign-up)
    // — create one first so the rest of the form has somewhere to save to.
    if (!session) {
      router.push("/sign-in");
      return;
    }
    setStep("parent");
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
      {step === "welcome" && <Stack.Screen options={{ headerShown: false }} />}
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
        {step === "welcome" && <WelcomeHero onStart={handleGetStarted} />}

        {step !== "welcome" && <Progress current={step} onBack={goBack} />}

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
              subtitle="Their exact birthdate — not just an age range — is how we get today's tip right."
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
                    <Pressable
                      onPress={() => removeChild(i)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${c.name}`}
                    >
                      <Text
                        style={{ color: colors.danger, fontSize: font.small, fontWeight: "600" }}
                      >
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {children.length === 0 && (
              <Text style={{ fontSize: font.small, color: colors.textFaint, fontStyle: "italic" }}>
                Add your first child below to get started.
              </Text>
            )}

            <View style={{ gap: spacing.md }}>
              <Field label="Child's name" value={cName} onChangeText={setCName} placeholder="Sam" />
              <DateSelect label="Birthdate" value={cDate} onChange={setCDate} />
            </View>

            <Pressable
              onPress={addDraft}
              disabled={!draftValid}
              hitSlop={8}
              accessibilityRole="button"
            >
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

function Progress({ current, onBack }: { current: Step; onBack: () => void }) {
  const idx = FORM_STEPS.indexOf(current);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ marginLeft: -spacing.xs, padding: spacing.xs }}
        >
          <Text style={{ fontSize: font.small, color: colors.textMuted, fontWeight: "700" }}>
            ‹ Back
          </Text>
        </Pressable>
        <Text style={{ fontSize: font.tiny, color: colors.textMuted, fontWeight: "600" }}>
          Step {idx + 1} of {FORM_STEPS.length}
        </Text>
      </View>
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
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.buttonSm,
          backgroundColor: colors.surfaceAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={{ fontSize: font.heading }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 1, paddingTop: 2 }}>
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
        accessibilityRole="header"
        style={{
          fontFamily: fonts.display,
          fontSize: font.title,
          fontWeight: "600",
          color: colors.heading,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: font.body, color: colors.textMuted }}>{subtitle}</Text>
    </View>
  );
}

function WelcomeHero({ onStart }: { onStart: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
      },
    ],
  };

  return (
    <Animated.View style={[{ gap: spacing.xl }, animatedStyle]}>
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.pill,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={logoMark}
              accessibilityLabel="DaybyDay logo"
              style={{ width: 34, height: 34 }}
              resizeMode="contain"
            />
          </View>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.body,
              fontWeight: "700",
              color: colors.heading,
              letterSpacing: 0.2,
            }}
          >
            DaybyDay
          </Text>
        </View>

        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: 34,
            lineHeight: 40,
            fontWeight: "600",
            color: colors.heading,
          }}
        >
          Know exactly what your child needs — today.
        </Text>
        <Text
          style={{
            fontSize: font.heading,
            lineHeight: 27,
            color: colors.text,
          }}
        >
          One small, age-perfect step each day. No searching, no second-guessing, no overwhelm.
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <ValueRow
          emoji="🌱"
          title="Matched to your child's exact age"
          body="Not generic advice — today's tip fits their exact stage, down to the week."
        />
        <ValueRow
          emoji="💬"
          title="Ask anything, get a real answer"
          body="Skip the late-night Google spiral. Ask Day and get something you can actually use."
        />
        <ValueRow
          emoji="📈"
          title="Grows with them, not just once"
          body="From newborn nights to big-kid feelings — it keeps up as they change."
        />
      </View>

      <View style={{ gap: spacing.md }}>
        <Button title="Get started — it's free" onPress={onStart} />
        <Text style={{ fontSize: font.small, color: colors.textMuted, textAlign: "center" }}>
          2 minutes to set up · Your family's info is never sold or shared
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: "/sign-in", params: { mode: "signin" } })}
          hitSlop={8}
          accessibilityRole="button"
          style={{ marginTop: spacing.xs }}
        >
          <Text
            style={{
              fontSize: font.small,
              color: colors.heading,
              fontWeight: "700",
              textAlign: "center",
              textDecorationLine: "underline",
            }}
          >
            Already have an account? Log in
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
