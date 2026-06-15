import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";
import { colors, fonts } from "../src/theme";
import "../src/install"; // registers the beforeinstallprompt listener early

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerShadowVisible: false,
            headerTintColor: colors.heading,
            contentStyle: { backgroundColor: colors.bg },
            headerTitleStyle: {
              fontFamily: fonts.display,
              fontWeight: "600",
              color: colors.heading,
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ title: "Welcome" }} />
          <Stack.Screen name="today" options={{ title: "Today" }} />
          <Stack.Screen name="settings" options={{ title: "Settings" }} />
          <Stack.Screen name="ask" options={{ title: "Ask Day" }} />
          <Stack.Screen name="timeline" options={{ title: "Milestones" }} />
          <Stack.Screen name="admin" options={{ title: "Admin" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
