import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../src/auth";
import { Button, Field, Screen } from "../src/components/ui";
import { colors, font, fonts, spacing } from "../src/theme";

export default function SignIn() {
  const { signInWithPassword, signUp } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.mode === "signin" ? "signin" : "signup",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const fn = mode === "signin" ? signInWithPassword : signUp;
    const { error: err } = await fn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/");
  }

  return (
    <Screen style={{ justifyContent: "center" }}>
      <View style={{ gap: spacing.lg, maxWidth: 420, width: "100%", alignSelf: "center" }}>
        <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: font.display,
              fontWeight: "600",
              color: colors.text,
            }}
          >
            DaybyDay
          </Text>
          <Text style={{ fontSize: font.body, color: colors.textMuted }}>
            The parenting companion that grows with your family, one day at a time.
          </Text>
        </View>

        {mode === "signup" ? (
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            {[
              "🌱  One age-perfect tip a day",
              "💬  Ask anything about your child",
              "📈  Grows with them, newborn to big kid",
            ].map((line) => (
              <Text key={line} style={{ fontSize: font.body, color: colors.text }}>
                {line}
              </Text>
            ))}
            <Text style={{ fontSize: font.tiny, color: colors.textMuted }}>
              Free · Takes 2 minutes to set up
            </Text>
          </View>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {error ? <Text style={{ color: colors.danger, fontSize: font.small }}>{error}</Text> : null}

        <Button
          title={mode === "signin" ? "Sign in" : "Create account"}
          onPress={submit}
          loading={busy}
        />

        <Text
          onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{ color: colors.primary, fontSize: font.small, textAlign: "center" }}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </Text>
      </View>
    </Screen>
  );
}
