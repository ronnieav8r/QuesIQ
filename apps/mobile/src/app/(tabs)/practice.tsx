import type { InterviewStyleKey, PracticeModeKey, QuestionTypeKey, SessionSetupSnapshot } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { bootstrapQueryKey, useBootstrap } from "@/lib/bootstrap";
import { useAuth } from "@/providers/auth-provider";
import { useActiveSession } from "@/providers/session-provider";
import { colors, radius, spacing } from "@/theme/tokens";
import { useQueryClient } from "@tanstack/react-query";

const modes: { description: string; key: PracticeModeKey; name: string }[] = [
  { description: "Open strong and sound like yourself.", key: "first_impression", name: "First Impression" },
  { description: "Pause for practical coaching between answers.", key: "coaching", name: "Coaching" },
  { description: "Build speed with concise back-to-back answers.", key: "rapid_fire", name: "Rapid Fire" },
  { description: "Run a realistic, uninterrupted interview.", key: "mock_interview", name: "Mock Interview" },
];
const stylesList: { key: InterviewStyleKey; label: string }[] = [{ key: "friendly", label: "Friendly" }, { key: "neutral", label: "Neutral" }, { key: "tough", label: "Challenging" }];
const questionTypes: { key: QuestionTypeKey; label: string }[] = [{ key: "behavioral", label: "Behavioral" }, { key: "technical", label: "Technical" }, { key: "hypothetical", label: "Situational" }, { key: "motivational", label: "Motivation" }];

function Choice({ active, detail, label, onPress }: { active: boolean; detail?: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[choiceStyles.wrap, active && choiceStyles.active]}><View style={choiceStyles.copy}><Text style={[choiceStyles.label, active && choiceStyles.activeText]}>{label}</Text>{detail ? <Text style={[choiceStyles.detail, active && choiceStyles.activeText]}>{detail}</Text> : null}</View>{active ? <Check color={colors.background} size={17} /> : <ChevronRight color={colors.muted} size={18} />}</Pressable>;
}

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = modes.some((item) => item.key === params.mode) ? params.mode as PracticeModeKey : "first_impression";
  const bootstrap = useBootstrap();
  const { request } = useAuth();
  const { setActiveSession } = useActiveSession();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState<string>();
  const [mode, setMode] = useState<PracticeModeKey>(initialMode);
  const [questionType, setQuestionType] = useState<QuestionTypeKey>("behavioral");
  const [style, setStyle] = useState<InterviewStyleKey>("friendly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chosenTarget = useMemo(() => bootstrap.data?.jobTargets.find((item) => item.id === targetId) ?? bootstrap.data?.jobTargets[0], [bootstrap.data?.jobTargets, targetId]);
  if (bootstrap.isLoading) return <LoadingState />;
  if (!bootstrap.data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Practice setup could not be loaded."} onRetry={() => bootstrap.refetch()} />;

  const launch = async () => {
    const connectivity = await NetInfo.fetch();
    if (!connectivity.isConnected) { setError("An internet connection is required to start a live session."); return; }
    const profile = bootstrap.data.profile;
    const snapshot: SessionSetupSnapshot = {
      interviewContext: {
        jobDescription: chosenTarget?.jobDescription ?? profile?.jobDescription ?? "",
        jobTargetId: chosenTarget?.id,
        preferredName: profile?.preferredName || bootstrap.data.user.name || "Candidate",
        resumeName: profile?.resumeName,
        resumeParsedAt: profile?.resumeParsedAt,
        targetCompany: chosenTarget?.targetCompany ?? profile?.targetCompany ?? "",
        targetRole: chosenTarget?.targetRole ?? profile?.targetRole ?? "",
      },
      modeKey: mode,
      questionTypeKey: questionType,
      rapidFireQuestionCount: mode === "rapid_fire" ? 5 : undefined,
      styleKey: style,
      turnBasedQuestionCount: mode === "first_impression" ? 1 : mode === "rapid_fire" ? 5 : 6,
    };
    setBusy(true); setError("");
    try {
      const result = await request<{ session: { id: string } }>("/api/mobile/v1/interview/sessions", { body: JSON.stringify({ snapshot }), method: "POST" });
      setActiveSession({ id: result.session.id, snapshot });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      router.push("/session");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The session could not be created."); }
    finally { setBusy(false); }
  };

  return <Screen eyebrow="Practice setup" subtitle="Choose the target and pressure level. You can end safely at any time." title="Build your session">
    <Card title="1. Target role">
      {bootstrap.data.jobTargets.length ? bootstrap.data.jobTargets.map((target) => <Choice active={chosenTarget?.id === target.id} detail={target.targetCompany} key={target.id} label={target.targetRole} onPress={() => setTargetId(target.id)} />) : <Text style={choiceStyles.detail}>Add a target in Me. You can still practice with your saved profile.</Text>}
    </Card>
    <Card title="2. Practice mode">{modes.map((item) => <Choice active={mode === item.key} detail={item.description} key={item.key} label={item.name} onPress={() => setMode(item.key)} />)}</Card>
    <Card title="3. Question focus"><View style={choiceStyles.chips}>{questionTypes.map((item) => <Pressable key={item.key} onPress={() => setQuestionType(item.key)} style={[choiceStyles.chip, questionType === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, questionType === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card>
    <Card title="4. Interviewer style"><View style={choiceStyles.chips}>{stylesList.map((item) => <Pressable key={item.key} onPress={() => setStyle(item.key)} style={[choiceStyles.chip, style === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, style === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card>
    {error ? <Text style={choiceStyles.error}>{error}</Text> : null}<Button label="Start live practice" loading={busy} onPress={launch} />
  </Screen>;
}

const choiceStyles = StyleSheet.create({
  active: { backgroundColor: colors.cyan, borderColor: colors.cyan }, activeText: { color: colors.background }, chip: { borderColor: colors.borderStrong, borderRadius: radius.pill, borderWidth: 1, minHeight: 42, paddingHorizontal: spacing.md, justifyContent: "center" },
  chipActive: { backgroundColor: colors.cyanDark, borderColor: colors.cyan }, chipText: { color: colors.textSoft, fontSize: 14, fontWeight: "700" }, chipTextActive: { color: colors.cyan }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  copy: { flex: 1, gap: 2 }, detail: { color: colors.muted, fontSize: 13, lineHeight: 18 }, error: { color: colors.danger, fontSize: 14 }, label: { color: colors.text, fontSize: 16, fontWeight: "700" },
  wrap: { alignItems: "center", borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 62, padding: spacing.md },
});
