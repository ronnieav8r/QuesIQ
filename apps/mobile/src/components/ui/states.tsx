import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, spacing } from "@/theme/tokens";

export function LoadingState({ label = "Loading your interview workspace…" }) {
  return <View style={styles.wrap}><ActivityIndicator color={colors.cyan} size="large" /><Text style={styles.text}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.wrap}><Text style={styles.title}>Something needs another try</Text><Text style={styles.text}>{message}</Text>{onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}</View>;
}

const styles = StyleSheet.create({
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  wrap: { alignItems: "center", flex: 1, gap: spacing.md, justifyContent: "center", padding: spacing.xl },
});
