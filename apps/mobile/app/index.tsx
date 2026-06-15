import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/auth";
import { api } from "../src/api-client";
import { colors } from "../src/theme";

/**
 * Entry router. Decides where to send the user:
 *  - no session            -> /sign-in
 *  - session, no account / not onboarded -> /onboarding
 *  - onboarded             -> /today
 */
export default function Index() {
  const { session, loading } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace("/sign-in");
      return;
    }

    let cancelled = false;
    setChecking(true);
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        const onboarded = me.parent.onboarding_step === "ONBOARDED" && me.children.length > 0;
        router.replace(onboarded ? "/today" : "/onboarding");
      })
      .catch(() => {
        // No account yet (404) or API down -> start onboarding.
        if (!cancelled) router.replace("/onboarding");
      })
      .finally(() => !cancelled && setChecking(false));

    return () => {
      cancelled = true;
    };
  }, [session, loading]);

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
      {checking ? null : null}
    </View>
  );
}
