import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { apiBaseUrl, parseApiResponse } from "@/lib/api";
import { colors, radius, spacing } from "@/theme/tokens";

type MessageResponse = { message: string };

async function postPublic<T>(path: string, body: Record<string, string>) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseApiResponse<T>(response);
}

export default function CreateAccountScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);

  const submit = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const body = { confirmPassword, email, password, ...(firstName.trim() ? { firstName: firstName.trim() } : {}) };
      const result = await postPublic<MessageResponse>("/api/mobile/v1/interview/auth/register", body);
      setMessage(result.message);
      setCanResend(true);
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account creation failed.");
    } finally { setBusy(false); }
  };

  const resendVerification = async () => {
    setBusy(true); setError("");
    try {
      const result = await postPublic<MessageResponse>("/api/mobile/v1/interview/auth/resend-verification", { email });
      setMessage(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification email could not be resent.");
    } finally { setBusy(false); }
  };

  return (
    <Screen keyboardAvoiding title="Create your account" subtitle="We’ll email you a verification link. Verify your email in your browser, then return here to sign in.">
      <View style={styles.form}>
        <TextInput accessibilityLabel="First name (optional)" autoCapitalize="words" autoComplete="given-name" maxLength={80} onChangeText={setFirstName} placeholder="First name (optional)" placeholderTextColor={colors.muted} style={styles.input} value={firstName} />
        <TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" maxLength={254} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <Text accessibilityHint="Password must be 10 to 128 characters and include at least one letter and one number." style={styles.hint}>Password: 10–128 characters, including a letter and a number.</Text>
        <TextInput accessibilityLabel="Password" autoComplete="new-password" maxLength={128} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        <TextInput accessibilityLabel="Confirm password" autoComplete="new-password" maxLength={128} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={confirmPassword} />
        {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.success}>{message} Check your inbox, then return to sign in.</Text> : null}
        <Button disabled={!email || !password || !confirmPassword} label="Create account" loading={busy} onPress={submit} />
        {canResend ? <Button disabled={!email} label="Resend verification email" loading={busy} onPress={resendVerification} variant="secondary" /> : null}
        <Button label="Back to sign in" onPress={() => router.replace("/sign-in")} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
  form: { gap: spacing.sm, paddingBottom: spacing.xl },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.md },
  success: { color: colors.lime, fontSize: 14, lineHeight: 21 },
});
