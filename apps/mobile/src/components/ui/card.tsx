import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/theme/tokens";

type CardProps = PropsWithChildren<{ accent?: "cyan" | "lime"; onPress?: () => void; title?: string; trailing?: ReactNode }>;

export function Card({ accent, children, onPress, title, trailing }: CardProps) {
  const content = (
    <>
      {(title || trailing) ? <View style={styles.header}><Text style={styles.title}>{title}</Text>{trailing}</View> : null}
      {children}
    </>
  );
  const style = [styles.card, accent === "cyan" && styles.cyan, accent === "lime" && styles.lime];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...style, pressed && styles.pressed]}>{content}</Pressable> : <View style={style}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  cyan: { borderColor: colors.cyanDark },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  lime: { borderColor: colors.limeDark },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  title: { color: colors.text, flex: 1, fontSize: 17, fontWeight: "700" },
});
