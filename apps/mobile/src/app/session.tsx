import type { VoiceSessionArtifact } from "@quesiq/interview-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NativeVoiceSession } from "@/components/interview/native-voice-session";
import { Button } from "@/components/ui/button";
import { bootstrapQueryKey } from "@/lib/bootstrap";
import { useAuth } from "@/providers/auth-provider";
import { useActiveSession } from "@/providers/session-provider";
import { colors, spacing } from "@/theme/tokens";

export default function LiveSessionScreen() {
  const { activeSession, clearActiveSession } = useActiveSession(); const { request } = useAuth(); const queryClient = useQueryClient(); const [saveError, setSaveError] = useState(""); const [pendingArtifact, setPendingArtifact] = useState<VoiceSessionArtifact>(); const [saving, setSaving] = useState(false);
  if (!activeSession) return <Redirect href="/(tabs)/practice" />;
  const persist = async (artifact: VoiceSessionArtifact) => {
    if (saving) return; setSaving(true); setSaveError(""); setPendingArtifact(artifact);
    try {
      await request(`/api/mobile/v1/interview/sessions/${activeSession.id}/artifact`, { body: JSON.stringify({ artifact }), method: "PUT" });
      await request(`/api/mobile/v1/interview/sessions/${activeSession.id}/evaluation`, { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }); clearActiveSession(); router.replace(`/review/${activeSession.id}`);
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : "The session could not be saved."); } finally { setSaving(false); }
  };
  if (pendingArtifact) return <View style={styles.saving}><Text style={styles.title}>{saving ? "Saving your practice…" : "Your session is safe on this device"}</Text><Text style={styles.body}>{saveError || "QuesIQ is storing the transcript and preparing your review."}</Text>{saveError ? <Button label="Retry save" loading={saving} onPress={() => void persist(pendingArtifact)} /> : null}</View>;
  return <NativeVoiceSession onArtifactFinalized={(artifact) => void persist(artifact)} sessionId={activeSession.id} snapshot={activeSession.snapshot} />;
}
const styles = StyleSheet.create({ body: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }, saving: { alignItems: "center", backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: "center", padding: spacing.xl }, title: { color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "center" } });
