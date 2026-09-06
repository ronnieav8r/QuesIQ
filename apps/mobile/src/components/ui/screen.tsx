import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type RefreshControlProps, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, layout, spacing, typography } from "@/theme/tokens";

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  scroll?: boolean;
  subtitle?: string;
  title?: string;
  trailing?: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  keyboardAvoiding?: boolean;
  bottomInset?: boolean;
}>;

export function Screen({ children, eyebrow, refreshControl, scroll = true, subtitle, title, trailing, keyboardAvoiding = false, bottomInset = true }: ScreenProps) {
  const body = (
    <View style={styles.body}>
      {(eyebrow || title || subtitle) ? (
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {trailing}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView testID="screen-safe-area" edges={bottomInset ? ["top", "right", "bottom", "left"] : ["top", "right", "left"]} style={styles.safe}>
      <KeyboardAvoidingView testID="screen-keyboard" enabled={keyboardAvoiding} behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.safe}>
        {scroll ? <ScrollView testID="screen-scroll" keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} refreshControl={refreshControl}>{body}</ScrollView> : body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignSelf: "center", width: "100%", maxWidth: layout.contentMaxWidth, gap: spacing.md, paddingHorizontal: layout.pageGutter, paddingTop: spacing.lg },
  eyebrow: { color: colors.cyan, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  headerCopy: { flex: 1, gap: spacing.xs },
  headerRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  safe: { backgroundColor: colors.background, flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  title: { color: colors.text, fontSize: typography.title, fontWeight: "800", letterSpacing: -0.8 },
});
