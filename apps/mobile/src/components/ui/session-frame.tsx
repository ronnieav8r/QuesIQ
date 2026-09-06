import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout, spacing } from "@/theme/tokens";

/** Presentation only: connection, recording, turn and save lifecycles stay with callers. */
export function SessionFrame({ active, children, footer, status, timer }: PropsWithChildren<{
  active: boolean; footer: ReactNode; status: string; timer: string;
}>) {
  return <SafeAreaView edges={["top", "right", "bottom", "left"]} style={styles.safe}>
    <View style={styles.header}>
      <View style={styles.status}><View style={[styles.dot, active && styles.active]} /><Text accessibilityLiveRegion="polite" style={styles.label}>{status}</Text></View>
      <Text accessibilityLabel={`Session time ${timer}`} style={styles.timer}>{timer}</Text>
    </View>
    <ScrollView testID="session-content" style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    <View testID="session-footer" style={styles.footer}>{footer}</View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, scroll: { flex: 1 },
  header: { alignSelf: "center", width: "100%", maxWidth: layout.contentMaxWidth, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: layout.pageGutter, borderBottomWidth: 1, borderBottomColor: colors.border },
  status: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { flex: 1, color: colors.textSoft, fontSize: 14, fontWeight: "700" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted }, active: { backgroundColor: colors.lime },
  timer: { color: colors.text, fontWeight: "800", fontSize: 16, fontVariant: ["tabular-nums"] },
  content: { alignSelf: "center", width: "100%", maxWidth: layout.contentMaxWidth, flexGrow: 1, alignItems: "center", gap: spacing.md, padding: layout.pageGutter },
  footer: { alignSelf: "center", width: "100%", maxWidth: layout.contentMaxWidth, padding: layout.pageGutter, gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
});
