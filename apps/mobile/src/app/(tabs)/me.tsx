import type { MobileBootstrap } from "@quesiq/interview-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { LogOut, Save } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { bootstrapQueryKey, useBootstrap } from "@/lib/bootstrap";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

export default function MeScreen() {
  const bootstrap = useBootstrap();
  if (bootstrap.isLoading) return <LoadingState />;
  if (bootstrap.isError || !bootstrap.data) return <ErrorState message="Your profile could not be loaded." onRetry={() => bootstrap.refetch()} />;
  const profileKey = `${bootstrap.data.profile?.preferredName}-${bootstrap.data.profile?.jobTargetId}-${bootstrap.data.jobTargets.length}`;
  return <MeForm bootstrap={bootstrap.data} key={profileKey} />;
}

function MeForm({ bootstrap }: { bootstrap: MobileBootstrap }) {
  const { request, signOut, user } = useAuth(); const queryClient = useQueryClient();
  const profile = bootstrap.profile; const initialTarget = bootstrap.jobTargets.find((item) => item.id === profile?.jobTargetId) ?? bootstrap.jobTargets[0];
  const [preferredName, setPreferredName] = useState(profile?.preferredName || user?.name || ""); const [targetRole, setTargetRole] = useState(initialTarget?.targetRole || profile?.targetRole || ""); const [targetCompany, setTargetCompany] = useState(initialTarget?.targetCompany || profile?.targetCompany || ""); const [jobDescription, setJobDescription] = useState(initialTarget?.jobDescription || profile?.jobDescription || "");
  const [busy, setBusy] = useState(false); const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle"); const [message, setMessage] = useState("");
  const save = async () => {
    setBusy(true); setSaveState("idle"); setMessage("");
    try {
      const existing = bootstrap.jobTargets.find((item) => item.id === profile?.jobTargetId) ?? bootstrap.jobTargets[0];
      const targetPath = existing ? `/api/mobile/v1/interview/job-targets/${existing.id}` : "/api/mobile/v1/interview/job-targets";
      const targetResult = await request<{ target: { id: string } }>(targetPath, { body: JSON.stringify({ target: { jobDescription, targetCompany, targetRole } }), method: existing ? "PUT" : "POST" });
      await request("/api/mobile/v1/interview/profile", { body: JSON.stringify({ profile: { jobDescription, jobTargetId: targetResult.target.id, preferredName, resumeName: profile?.resumeName, resumeParsedAt: profile?.resumeParsedAt, targetCompany, targetRole } }), method: "PUT" });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }); setSaveState("success"); setMessage("Profile saved locally.");
    } catch (cause) { setSaveState("error"); setMessage(cause instanceof Error ? cause.message : "Profile could not be saved."); } finally { setBusy(false); }
  };
  return <Screen bottomInset={false} eyebrow="Your setup" keyboardAvoiding subtitle={user?.email || "Local development account"} title="Me">
    <Card title="Interview profile"><Field editable={!busy} label="Preferred name" onChangeText={setPreferredName} value={preferredName} /></Card>
    <Card title="Active job target"><Field editable={!busy} label="Target role" onChangeText={setTargetRole} value={targetRole} /><Field editable={!busy} label="Company" onChangeText={setTargetCompany} value={targetCompany} /><Field editable={!busy} label="Job description" multiline onChangeText={setJobDescription} value={jobDescription} />{message ? <Text accessibilityRole="alert" style={[styles.message, saveState === "error" ? styles.error : styles.success]}>{message}</Text> : null}<Button disabled={!preferredName || !targetRole} icon={Save} label="Save profile" loading={busy} onPress={save} /></Card>
    <Card title="Resume"><Text style={styles.support}>{profile?.resumeName ? `${profile.resumeParsedAt ? "Parsed" : "Attached, parsing status unavailable"}: ${profile.resumeName}` : "No parsed resume is connected yet. Resume upload is not part of this mobile slice."}</Text></Card>
    <Button icon={LogOut} label="Sign out" onPress={async () => { await signOut(); queryClient.clear(); router.replace("/sign-in"); }} variant="danger" />
  </Screen>;
}
function Field({ editable = true, label, multiline, onChangeText, value }: { editable?: boolean; label: string; multiline?: boolean; onChangeText: (text: string) => void; value: string }) { return <><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={editable} multiline={multiline} onChangeText={onChangeText} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline, !editable && styles.readonly]} value={value} /></>; }
const styles = StyleSheet.create({ error: { color: colors.danger }, input: { backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, label: { color: colors.textSoft, fontSize: 13, fontWeight: "700", marginTop: spacing.xs }, message: { fontSize: 14, lineHeight: 20 }, multiline: { minHeight: 120, textAlignVertical: "top" }, readonly: { opacity: 0.7 }, success: { color: colors.lime }, support: { color: colors.muted, fontSize: 14, lineHeight: 21 } });
