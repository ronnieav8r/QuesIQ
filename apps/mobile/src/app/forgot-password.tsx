import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { apiBaseUrl, parseApiResponse } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/tokens";

type MessageResponse = { message: string };

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/mobile/v1/interview/auth/password-reset/request`, { body: JSON.stringify({ email }), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = await parseApiResponse<MessageResponse>(response);
      setMessage(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password reset request failed.");
    } finally { setBusy(false); }
  };

  return (
    <Screen keyboardAvoiding title="Reset your password" subtitle="We’ll email a password reset link. Open it in your browser, then return here to sign in.">
      <View style={styles.form}>
        <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.success}>{message} Check your inbox, then return to sign in.</Text> : null}
        <Button disabled={!email} label="Email reset link" loading={busy} onPress={submit} />
        <Button label="Back to sign in" onPress={() => router.replace("/sign-in")} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  form: { gap: spacing.sm, paddingBottom: spacing.xl },
  input: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.md },
  success: { color: colors.lime, fontSize: 14, lineHeight: 21 },
});
