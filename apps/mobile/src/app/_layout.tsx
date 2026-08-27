import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider } from "@/providers/app-provider";
import { colors } from "@/theme/tokens";

const interviewTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, border: colors.border, card: colors.panel, primary: colors.cyan, text: colors.text } };

export default function RootLayout() {
  return (
    <ThemeProvider value={interviewTheme}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="session" options={{ animation: "fade", gestureEnabled: false }} />
            <Stack.Screen name="review/[sessionId]" />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
