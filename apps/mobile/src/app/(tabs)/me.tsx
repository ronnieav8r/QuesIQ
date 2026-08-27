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
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const existing = bootstrap.jobTargets.find((item) => item.id === profile?.jobTargetId) ?? bootstrap.jobTargets[0];
      const targetPath = existing ? `/api/mobile/v1/interview/job-targets/${existing.id}` : "/api/mobile/v1/interview/job-targets";
      const targetResult = await request<{ target: { id: string } }>(targetPath, { body: JSON.stringify({ target: { jobDescription, targetCompany, targetRole } }), method: existing ? "PUT" : "POST" });
      await request("/api/mobile/v1/interview/profile", { body: JSON.stringify({ profile: { jobDescription, jobTargetId: targetResult.target.id, preferredName, resumeName: profile?.resumeName, resumeParsedAt: profile?.resumeParsedAt, targetCompany, targetRole } }), method: "PUT" });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }); setMessage("Profile saved locally.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Profile could not be saved."); } finally { setBusy(false); }
  };
  return <Screen eyebrow="Your setup" subtitle={user?.email || "Local development account"} title="Me">
    <Card title="Interview profile"><Field label="Preferred name" onChangeText={setPreferredName} value={preferredName} /><Field label="Target role" onChangeText={setTargetRole} value={targetRole} /><Field label="Company" onChangeText={setTargetCompany} value={targetCompany} /><Field label="Job description" multiline onChangeText={setJobDescription} value={jobDescription} />{message ? <Text style={styles.message}>{message}</Text> : null}<Button disabled={!preferredName || !targetRole} icon={Save} label="Save profile" loading={busy} onPress={save} /></Card>
    <Card title="Resume"><Text style={styles.support}>{profile?.resumeName ? `Ready: ${profile.resumeName}` : "No parsed resume is connected yet. Resume upload remains available in the web fallback during local development."}</Text></Card>
    <Button icon={LogOut} label="Sign out" onPress={async () => { await signOut(); queryClient.clear(); router.replace("/sign-in"); }} variant="danger" />
  </Screen>;
}
function Field({ label, multiline, onChangeText, value }: { label: string; multiline?: boolean; onChangeText: (text: string) => void; value: string }) { return <><Text style={styles.label}>{label}</Text><TextInput multiline={multiline} onChangeText={onChangeText} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline]} value={value} /></>; }
const styles = StyleSheet.create({ input: { backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, label: { color: colors.textSoft, fontSize: 13, fontWeight: "700", marginTop: spacing.xs }, message: { color: colors.lime, fontSize: 14 }, multiline: { minHeight: 120, textAlignVertical: "top" }, support: { color: colors.muted, fontSize: 14, lineHeight: 21 } });
