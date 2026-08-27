import type { ComponentType } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { LucideProps } from "lucide-react-native";

import { colors, radius, spacing } from "@/theme/tokens";

type ButtonProps = { disabled?: boolean; icon?: ComponentType<LucideProps>; label: string; loading?: boolean; onPress: () => void; variant?: "primary" | "secondary" | "danger" };

export function Button({ disabled, icon: Icon, label, loading, onPress, variant = "primary" }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable accessibilityRole="button" disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.base, styles[variant], pressed && !inactive && styles.pressed, inactive && styles.disabled]}>
      {loading ? <ActivityIndicator color={variant === "primary" ? colors.background : colors.text} /> : Icon ? <Icon color={variant === "primary" ? colors.background : colors.text} size={19} strokeWidth={2.4} /> : null}
      <Text style={[styles.label, variant === "primary" && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", borderRadius: radius.md, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 54, paddingHorizontal: spacing.md },
  danger: { backgroundColor: "transparent", borderColor: colors.danger, borderWidth: 1 },
  disabled: { opacity: 0.45 },
  label: { color: colors.text, fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  primary: { backgroundColor: colors.cyan },
  primaryLabel: { color: colors.background },
  secondary: { backgroundColor: colors.panelStrong, borderColor: colors.borderStrong, borderWidth: 1 },
});
