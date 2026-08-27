import type { PropsWithChildren, ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme/tokens";

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  scroll?: boolean;
  subtitle?: string;
  title?: string;
  trailing?: ReactNode;
}>;

export function Screen({ children, eyebrow, scroll = true, subtitle, title, trailing }: ScreenProps) {
  const body = (
    <View style={styles.body}>
      {(eyebrow || title || subtitle) ? (
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  eyebrow: { color: colors.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  headerCopy: { flex: 1, gap: spacing.xs },
  headerRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  safe: { backgroundColor: colors.background, flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
});
