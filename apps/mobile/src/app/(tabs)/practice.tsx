import { interviewExecutionConfigSchema, type InterviewStyleKey, type PracticeModeKey, type QuestionTypeKey, type SessionSetupSnapshot } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { bootstrapQueryKey, useBootstrap } from "@/lib/bootstrap";
import { availablePracticeModes, canLaunchPractice, preferredTargetId, resolveCatalogChoice, resolvePracticeMode } from "@/lib/practice-catalog";
import { useAuth } from "@/providers/auth-provider";
import { useActiveSession } from "@/providers/session-provider";
import { colors, layout, radius, spacing } from "@/theme/tokens";
import { useQueryClient } from "@tanstack/react-query";

function Choice({ active, detail, label, onPress }: { active: boolean; detail?: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[choiceStyles.wrap, active && choiceStyles.active]}><View style={choiceStyles.copy}><Text style={[choiceStyles.label, active && choiceStyles.activeText]}>{label}</Text>{detail ? <Text style={[choiceStyles.detail, active && choiceStyles.activeText]}>{detail}</Text> : null}</View>{active ? <Check color={colors.background} size={17} /> : <ChevronRight color={colors.muted} size={18} />}</Pressable>;
}

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const bootstrap = useBootstrap();
  const { request } = useAuth();
  const { setActiveSession } = useActiveSession();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState<string>();
  const [mode, setMode] = useState<PracticeModeKey>();
  const [questionType, setQuestionType] = useState<QuestionTypeKey>();
  const [style, setStyle] = useState<InterviewStyleKey>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const data = bootstrap.data;
  const modes = availablePracticeModes(data?.catalog ?? { practiceModes: [], interviewStyles: [], questionTypes: [] });
  const stylesList = data?.catalog.interviewStyles ?? [];
  const questionTypes = data?.catalog.questionTypes ?? [];
  const resolvedMode = resolvePracticeMode(mode, params.mode, modes);
  const resolvedStyle = resolveCatalogChoice(style, stylesList);
  const resolvedQuestionType = resolveCatalogChoice(questionType, questionTypes);
  const targets = data?.jobTargets ?? [];
  const resolvedTargetId = targetId && targets.some((target) => target.id === targetId) ? targetId : data ? preferredTargetId(data) : undefined;
  const chosenTarget = targets.find((item) => item.id === resolvedTargetId);
  const selectedMode = modes.find((item) => item.key === resolvedMode);
  // Defaults are derived above; state records only deliberate user choices.

  if (bootstrap.isLoading) return <LoadingState />;
  if (!data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Practice setup could not be loaded."} onRetry={() => bootstrap.refetch()} />;

  const launch = async () => {
    const connectivity = await NetInfo.fetch();
    if (!connectivity.isConnected) { setError("An internet connection is required to start a live session."); return; }
    const profile = data.profile;
    if (!selectedMode || !canLaunchPractice(selectedMode, resolvedStyle, resolvedQuestionType) || !resolvedMode || !resolvedStyle) { setError("This practice setup is no longer available."); return; }
    const snapshot: SessionSetupSnapshot = {
      interviewContext: {
        jobDescription: chosenTarget?.jobDescription ?? profile?.jobDescription ?? "",
        jobTargetId: chosenTarget?.id,
        preferredName: profile?.preferredName || data.user.name || "Candidate",
        resumeName: profile?.resumeName,
        resumeParsedAt: profile?.resumeParsedAt,
        targetCompany: chosenTarget?.targetCompany ?? profile?.targetCompany ?? "",
        targetRole: chosenTarget?.targetRole ?? profile?.targetRole ?? "",
      },
      modeKey: resolvedMode,
      questionTypeKey: selectedMode.questionTypeRequired ? resolvedQuestionType : undefined,
      rapidFireQuestionCount: resolvedMode === "rapid_fire" ? 5 : undefined,
      styleKey: resolvedStyle,
      turnBasedQuestionCount: resolvedMode === "first_impression" ? 1 : resolvedMode === "rapid_fire" ? 5 : 6,
    };
    if (!modes.length) { setError("No practice modes are currently available."); return; }
    setBusy(true); setError("");
    try {
      const result = await request<{ session: { id: string }; executionConfig: unknown }>("/api/mobile/v1/interview/sessions", { body: JSON.stringify({ snapshot }), method: "POST" });
      const executionConfig = interviewExecutionConfigSchema.parse(result.executionConfig);
      if (executionConfig.configured.modeKey !== snapshot.modeKey || !executionConfig.effective.enabled) throw new Error("The selected practice mode is no longer available.");
      setActiveSession({ id: result.session.id, snapshot: { ...snapshot, executionConfig } });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      router.push("/session");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The session could not be created."); }
    finally { setBusy(false); }
  };

  return <Screen bottomInset={false} eyebrow="QuesIQ Interview" subtitle="Choose your focus. Practice one honest answer at a time." title="Practice" trailing={<Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push("/(tabs)/me")} style={choiceStyles.profile}><Text style={choiceStyles.profileText}>{(data.profile?.preferredName || data.user.name || "Me").slice(0, 2).toUpperCase()}</Text></Pressable>}>
    <Card title="1. Target role">
      {data.jobTargets.length ? data.jobTargets.map((target) => <Choice active={chosenTarget?.id === target.id} detail={target.targetCompany} key={target.id} label={target.targetRole} onPress={() => setTargetId(target.id)} />) : <Text style={choiceStyles.detail}>Add a target in Me. You can still practice with your saved profile.</Text>}
    </Card>
    <Card title="2. Practice mode">{modes.length ? modes.map((item) => <Choice active={resolvedMode === item.key} detail={item.description} key={item.key} label={item.name} onPress={() => setMode(item.key)} />) : <Text style={choiceStyles.detail}>No practice modes are currently available.</Text>}</Card>
    {selectedMode?.questionTypeRequired ? <Card title="3. Question focus"><View style={choiceStyles.chips}>{questionTypes.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: resolvedQuestionType === item.key }} key={item.key} onPress={() => setQuestionType(item.key)} style={[choiceStyles.chip, resolvedQuestionType === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, resolvedQuestionType === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card> : null}
    <Card title={`${selectedMode?.questionTypeRequired ? 4 : 3}. Interviewer style`}><View style={choiceStyles.chips}>{stylesList.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: resolvedStyle === item.key }} key={item.key} onPress={() => setStyle(item.key)} style={[choiceStyles.chip, resolvedStyle === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, resolvedStyle === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card>
    <Card accent="cyan" title="Ready when you are"><Text style={choiceStyles.summary}>{selectedMode?.name || "Select an available mode"}{chosenTarget?.targetRole ? ` · ${chosenTarget.targetRole}` : ""}</Text><Text style={choiceStyles.detail}>Your first question is prepared after you start. Microphone access is requested in the live session; you can end and save at any time.</Text>
      {error ? <Text accessibilityRole="alert" style={choiceStyles.error}>{error}</Text> : null}<Button label="Start live practice" disabled={!canLaunchPractice(selectedMode, resolvedStyle, resolvedQuestionType)} loading={busy} onPress={launch} />
    </Card>
  </Screen>;
}

const choiceStyles = StyleSheet.create({
  active: { backgroundColor: colors.cyan, borderColor: colors.cyan }, activeText: { color: colors.background }, chip: { borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, minHeight: layout.minTouchTarget, maxWidth: "100%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: "center" },
  profile: { minWidth: layout.minTouchTarget, minHeight: layout.minTouchTarget, borderRadius: radius.pill, backgroundColor: colors.cyanDark, justifyContent: "center", alignItems: "center", padding: spacing.sm }, profileText: { color: colors.cyan, fontWeight: "800" }, summary: { color: colors.lime, fontSize: 16, fontWeight: "700" },
  chipActive: { backgroundColor: colors.cyanDark, borderColor: colors.cyan }, chipText: { color: colors.textSoft, fontSize: 14, fontWeight: "700" }, chipTextActive: { color: colors.cyan }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  copy: { flex: 1, gap: 2 }, detail: { color: colors.muted, fontSize: 13, lineHeight: 18 }, error: { color: colors.danger, fontSize: 14 }, label: { color: colors.text, fontSize: 16, fontWeight: "700" },
  wrap: { alignItems: "center", borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 62, padding: spacing.md },
});
