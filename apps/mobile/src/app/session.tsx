import { interviewExecutionConfigSchema, type VoiceSessionArtifact } from "@quesiq/interview-contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeVoiceSession } from "@/components/interview/native-voice-session";
import { ChainedCoachingSession } from "@/components/interview/chained-coaching-session";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";
import { bootstrapQueryKey } from "@/lib/bootstrap";
import { resolveSessionExperience } from "@/lib/session-engine";
import {
  deletePendingArtifact,
  savePendingArtifact,
} from "@/lib/pending-artifact";
import { persistSessionArtifact, SavedArtifactEvaluationError, withArtifactPersistenceLock } from "@/lib/session-persistence";
import { useAuth } from "@/providers/auth-provider";
import { useActiveSession } from "@/providers/session-provider";
import { colors, spacing } from "@/theme/tokens";

export default function LiveSessionScreen() {
  const { activeSession, clearActiveSession } = useActiveSession();
  const { request, user } = useAuth();
  const queryClient = useQueryClient();
  const accountRef = useRef(user?.id);
  const [sessionOwnerId] = useState(user?.id);
  useEffect(() => { accountRef.current = user?.id; return () => { accountRef.current = undefined; }; }, [user?.id]);
  const [saveError, setSaveError] = useState("");
  const [checkpointFailed, setCheckpointFailed] = useState(false);
  const [pendingArtifact, setPendingArtifact] = useState<VoiceSessionArtifact>();
  const [savedOnDevice, setSavedOnDevice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverSaved, setServerSaved] = useState(false);
  const stagedRef = useRef(false);
  const savingRef = useRef(false);
  const serverSavedRef = useRef(false);
  if (!activeSession) return <Redirect href="/(tabs)/practice" />;
  const parsedExecution = activeSession.snapshot.executionConfig ? interviewExecutionConfigSchema.safeParse(activeSession.snapshot.executionConfig) : undefined;
  const execution = parsedExecution?.success ? parsedExecution.data : undefined;
  const experience = activeSession.snapshot.executionConfig && !parsedExecution?.success ? "blocked_invalid_configuration" : resolveSessionExperience(activeSession.snapshot.modeKey, execution);
  const canRetrySave = Boolean(user && sessionOwnerId === user.id);

  const checkpoint = (artifact: VoiceSessionArtifact) => {
    if (!user || stagedRef.current) return;
    try { savePendingArtifact({ artifact, createdAt: new Date().toISOString(), sessionId: activeSession.id, ownerId: user.id, phase: "active" }); setCheckpointFailed(false); } catch { setCheckpointFailed(true); }
  };
  const persist = async (artifact: VoiceSessionArtifact) => {
    if (savingRef.current || !user) return;
    if (!sessionOwnerId || sessionOwnerId !== user.id || accountRef.current !== user.id) {
      setPendingArtifact(artifact);
      setSaveError("Sign in to the original account to finish saving this session.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setPendingArtifact(artifact);

    if (!stagedRef.current) {
      try {
        savePendingArtifact({
          artifact, ownerId: user.id, phase: "finalized",
          createdAt: new Date().toISOString(),
          sessionId: activeSession.id,
        });
        stagedRef.current = true;
        setSavedOnDevice(true);
      } catch {
        setSavedOnDevice(false);
      }
    }

    try {
      await withArtifactPersistenceLock(user.id, activeSession.id, () => persistSessionArtifact((path, init) => {
        if (accountRef.current !== user.id) return Promise.reject(new Error("Sign in to the original account to finish saving."));
        return request(path, init);
      }, activeSession.id, artifact, serverSavedRef.current));
      deletePendingArtifact(activeSession.id, user.id);
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      if (accountRef.current !== user.id || sessionOwnerId !== user.id) return;
      clearActiveSession();
      router.replace(`/review/${activeSession.id}`);
    } catch (cause) {
      if (cause instanceof SavedArtifactEvaluationError) {
        serverSavedRef.current = true; setServerSaved(true);
        try { savePendingArtifact({ artifact, ownerId: user.id, sessionId: activeSession.id, createdAt: new Date().toISOString(), phase: "finalized", serverSaved: true }); setSavedOnDevice(true); } catch { /* Keep the last verified local copy. */ }
      }
      setSaveError(cause instanceof Error ? cause.message : "The session could not be saved.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const abandon = () => {
    clearActiveSession();
    router.replace("/(tabs)/practice");
  };

  if (experience === "blocked_disabled" || experience === "blocked_invalid_configuration") return (
    <Screen><View style={styles.saving}>
      <Text style={styles.title}>This practice session is unavailable</Text>
      <Text style={styles.body}>{experience === "blocked_disabled" ? "This practice mode is currently unavailable." : "This saved session configuration is no longer valid."}</Text>
      <Button label="Back to practice" onPress={abandon} />
    </View></Screen>
  );

  if (pendingArtifact) return (
    <Screen><View style={styles.saving}>
      <Text style={styles.title}>
        {saving
          ? "Saving your practice…"
          : pendingArtifact.events.some((event) => event.type.includes("safety_pause"))
            ? "Practice paused for account safety"
          : savedOnDevice
            ? "Your session is safe on this device"
            : "Session save needs attention"}
      </Text>
      <Text accessibilityRole={saveError ? "alert" : undefined} accessibilityLiveRegion="polite" style={styles.body}>
        {saveError || (pendingArtifact.events.some((event) => event.type.includes("safety_pause"))
          ? "Your committed transcript is being stored. This screen will not claim it is saved until storage succeeds."
          : "QuesIQ is storing the transcript and preparing your review.")}
      </Text>
      {serverSaved ? <Button label="Open saved session" onPress={() => { clearActiveSession(); router.replace(`/review/${activeSession.id}`); }} /> : null}
      {saveError && canRetrySave ? (
        <Button
          label={serverSaved ? "Retry review" : "Retry save"}
          loading={saving}
          onPress={() => void persist(pendingArtifact)}
        />
      ) : null}
    </View></Screen>
  );

  if (experience === "chained_coaching") {
    return (
      <ChainedCoachingSession
        recoveryWarning={checkpointFailed}
        onArtifactCheckpoint={checkpoint}
        onArtifactFinalized={(artifact) => void persist(artifact)}
        sessionId={activeSession.id}
        snapshot={activeSession.snapshot}
      />
    );
  }

  if (experience === "blocked_unsupported_turn_based") return <SafeAreaView><Text style={styles.body}>This execution mode is not supported.</Text></SafeAreaView>;

  return (
    <NativeVoiceSession
      onAbandon={abandon}
      onArtifactCheckpoint={checkpoint}
      onArtifactFinalized={(artifact) => void persist(artifact)}
      recoveryWarning={checkpointFailed}
      sessionId={activeSession.id}
      snapshot={activeSession.snapshot}
    />
  );
}
const styles = StyleSheet.create({ body: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" }, saving: { alignItems: "center", backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: "center", padding: spacing.xl }, title: { color: colors.text, fontSize: 25, fontWeight: "900", textAlign: "center" } });
