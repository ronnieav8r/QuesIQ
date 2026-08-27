import { router } from "expo-router";
import { LockKeyhole } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

export default function SignInScreen() {
  const { ready, signInDev, signInEmail, tokens } = useAuth();
  const autoStarted = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && tokens) router.replace("/(tabs)/home");
  }, [ready, tokens]);

  useEffect(() => {
    if (!__DEV__ || !ready || tokens || autoStarted.current || process.env.EXPO_PUBLIC_DEV_AUTO_SIGN_IN === "false") return;
    autoStarted.current = true;
    setBusy(true);
    signInDev().catch((cause) => setError(cause instanceof Error ? cause.message : "Local sign-in failed.")).finally(() => setBusy(false));
  }, [ready, signInDev, tokens]);

  const submit = async () => {
    setBusy(true); setError("");
    await signInEmail(email, password).catch((cause) => setError(cause instanceof Error ? cause.message : "Sign-in failed."));
    setBusy(false);
  };

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Image resizeMode="contain" source={require("../../assets/images/quesiq-interview-logo.png")} style={styles.logo} />
        <Text style={styles.title}>Practice that sounds like you.</Text>
        <Text style={styles.subtitle}>Build sharper answers with Que, your live interview coach.</Text>
      </View>
      <View style={styles.form}>
        <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.muted} style={styles.input} value={email} />
        <TextInput autoComplete="password" onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button disabled={!email || !password} icon={LockKeyhole} label="Sign in" loading={busy} onPress={submit} />
        {__DEV__ ? <Button label="Continue locally" loading={busy} onPress={() => { setBusy(true); signInDev().catch((cause) => setError(cause instanceof Error ? cause.message : "Local sign-in failed.")).finally(() => setBusy(false)); }} variant="secondary" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 }, form: { gap: spacing.sm, paddingBottom: spacing.xl },
  hero: { flex: 1, gap: spacing.md, justifyContent: "center" },
  input: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 54, paddingHorizontal: spacing.md },
  logo: { alignSelf: "flex-start", height: 72, width: 170 }, subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  title: { color: colors.text, fontSize: 35, fontWeight: "900", letterSpacing: -1.1, lineHeight: 40 },
});
