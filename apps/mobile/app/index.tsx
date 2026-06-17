import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/auth";
import { api, ApiError } from "../src/api-client";
import { colors } from "../src/theme";

/** Resolve the account with a couple of retries so a transient API hiccup
 * (e.g. a Railway cold start) doesn't get mistaken for "no account". */
async function resolveMe(retries = 2): Promise<Awaited<ReturnType<typeof api.me>>> {
  try {
    return await api.me();
  } catch (e) {
    // A real 404 means no account yet — don't retry, let the caller onboard.
    if (e instanceof ApiError && e.status === 404) throw e;
    if (retries <= 0) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return resolveMe(retries - 1);
  }
}

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
    resolveMe()
      .then((me) => {
        if (cancelled) return;
        const onboarded = me.parent.onboarding_step === "ONBOARDED" && me.children.length > 0;
        router.replace(onboarded ? "/today" : "/onboarding");
      })
      .catch((e) => {
        if (cancelled) return;
        // Only a real 404 means "no account" → onboard. On any other failure the
        // user has a valid session, so send them to Today (which re-checks) rather
        // than bouncing them back to the Welcome/onboarding screen.
        if (e instanceof ApiError && e.status === 404) router.replace("/onboarding");
        else router.replace("/today");
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
