import { interviewExecutionConfigSchema, type InterviewStyleKey, type PracticeModeKey, type QuestionTypeKey, type SessionSetupSnapshot } from "@quesiq/interview-contracts";
import NetInfo from "@react-native-community/netinfo";
import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";

function Choice({ active, detail, label, onPress }: { active: boolean; detail?: string; label: string; onPress: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[choiceStyles.wrap, active && choiceStyles.active]}><View style={choiceStyles.copy}><Text style={[choiceStyles.label, active && choiceStyles.activeText]}>{label}</Text>{detail ? <Text style={[choiceStyles.detail, active && choiceStyles.activeText]}>{detail}</Text> : null}</View>{active ? <Check color={colors.background} size={17} /> : <ChevronRight color={colors.muted} size={18} />}</Pressable>;
}

export default function PracticeScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string; storyId?: string; introductionId?: string; questionIds?: string; queueTarget?: string; recommendationId?: string; recommendationTarget?: string }>();
  return <PracticeForm key={[user?.id, params.mode, params.storyId, params.introductionId, params.questionIds, params.queueTarget, params.recommendationId].join(":")} />;
}
function PracticeForm() {
  const params = useLocalSearchParams<{ mode?: string; storyId?: string; introductionId?: string; questionIds?: string; queueTarget?: string; recommendationId?: string; recommendationTarget?: string }>();
  const bootstrap = useBootstrap();
  const { request, user } = useAuth();
  const { setActiveSession } = useActiveSession();
  const queryClient = useQueryClient();
  const owner = useRef<string | undefined>(user?.id ?? "local-test");
  useEffect(() => { owner.current = user?.id ?? "local-test"; return () => { owner.current = undefined; }; }, [user?.id]);
  const launching = useRef(false);
  const [mode, setMode] = useState<PracticeModeKey>();
  const [questionType, setQuestionType] = useState<QuestionTypeKey>();
  const [style, setStyle] = useState<InterviewStyleKey>();
  const [rapidFireQuestionCount, setRapidFireQuestionCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [useSavedStories, setUseSavedStories] = useState(true);
  const [includeSelected, setIncludeSelected] = useState(true);
  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [includeRecommendation, setIncludeRecommendation] = useState(true);
  const selectedIds = includeQuestions && params.questionIds ? params.questionIds.split(",").filter(Boolean) : [];

  const data = bootstrap.data;
  const modes = availablePracticeModes(data?.catalog ?? { practiceModes: [], interviewStyles: [], questionTypes: [] });
  const stylesList = data?.catalog.interviewStyles ?? [];
  const questionTypes = data?.catalog.questionTypes ?? [];
  const resolvedMode = resolvePracticeMode(mode, params.mode, modes);
  const resolvedStyle = resolveCatalogChoice(style, stylesList);
  const resolvedQuestionType = resolveCatalogChoice(questionType, questionTypes);
  const targets = data?.jobTargets ?? [];
  const resolvedTargetId = includeQuestions && params.queueTarget ? params.queueTarget === "general" ? undefined : params.queueTarget : data ? preferredTargetId(data) : undefined;
  const chosenTarget = targets.find((item) => item.id === resolvedTargetId);
  const selectedMode = modes.find((item) => item.key === resolvedMode);
  const selectedRapidFireCount = selectedIds.length || Math.min(10, Math.max(1, rapidFireQuestionCount));
  const preparationSelections = { useSavedStories, storyId: includeSelected && resolvedMode === "coaching" ? params.storyId : undefined, introductionId: includeSelected && resolvedMode === "first_impression" ? params.introductionId : undefined };
  const materialQuery = new URLSearchParams({ useSavedStories: String(useSavedStories), ...(resolvedTargetId ? { targetId: resolvedTargetId } : {}), ...(preparationSelections.storyId ? { storyId: preparationSelections.storyId } : {}), ...(preparationSelections.introductionId ? { introductionId: preparationSelections.introductionId } : {}) }).toString();
  const materials = useQuery({ enabled: Boolean(user?.id && data), queryKey: ["mobile-practice-material", user?.id, materialQuery], queryFn: () => request<{ materials: Array<{ id: string; title: string; revision: number }> }>(`/api/mobile/v1/interview/story-lab/context?${materialQuery}`) });
  // Defaults are derived above; state records only deliberate user choices.

  if (bootstrap.isLoading) return <LoadingState />;
  if (!data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Practice setup could not be loaded."} onRetry={() => bootstrap.refetch()} />;

  const activateTarget = async (id: string | null) => {
    if (launching.current) return; launching.current = true; setBusy(true); setError(""); const account = owner.current;
    try {
      const current = await request<{ revision: number }>("/api/mobile/v1/interview/preparation");
      if (owner.current !== account) return;
      await request("/api/mobile/v1/interview/preparation", { method: "PUT", body: JSON.stringify({ revision: current.revision, change: { action: "target_active", id } }) });
      if (owner.current === account) { setIncludeRecommendation(false); setIncludeQuestions(false); await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey }); }
    } catch (cause) { if (owner.current === account) setError(cause instanceof Error ? cause.message : "Target could not be selected."); }
    finally { launching.current = false; if (owner.current === account) setBusy(false); }
  };

  const launch = async () => {
    if (launching.current) return;
    const account = owner.current;
    const profile = data.profile;
    if (selectedIds.length && (resolvedMode !== "coaching" && resolvedMode !== "rapid_fire" || resolvedMode === "coaching" && selectedIds.length !== 1)) { setError("Use Coaching for one exact question, or Rapid Fire for the ordered set."); return; }
    if (!selectedMode || !canLaunchPractice(selectedMode, resolvedStyle, resolvedQuestionType) || !resolvedMode || !resolvedStyle) { setError("This practice setup is no longer available."); return; }
    const snapshot: SessionSetupSnapshot = {
      ...(includeRecommendation && params.recommendationId ? { recommendationSelection: { id: params.recommendationId, targetId: params.recommendationTarget && params.recommendationTarget !== "general" ? params.recommendationTarget : null } } : {}),
      ...(selectedIds.length && (resolvedMode === "coaching" || resolvedMode === "rapid_fire") ? { questionSelection: { ids: selectedIds, mode: resolvedMode } } : {}),
      preparationSelections,
      interviewContext: {
        jobDescription: chosenTarget?.jobDescription ?? "",
        jobTargetId: resolvedTargetId,
        preferredName: profile?.preferredName || data.user.name || "Candidate",
        resumeName: profile?.resumeName,
        resumeParsedAt: profile?.resumeParsedAt,
        targetCompany: chosenTarget?.targetCompany ?? "",
        targetRole: chosenTarget?.targetRole ?? "",
      },
      modeKey: resolvedMode,
      questionTypeKey: selectedMode.questionTypeRequired ? resolvedQuestionType : undefined,
      rapidFireQuestionCount: resolvedMode === "rapid_fire" ? selectedRapidFireCount : undefined,
      styleKey: resolvedStyle,
      turnBasedQuestionCount: selectedIds.length || (resolvedMode === "first_impression" ? 1 : resolvedMode === "rapid_fire" ? selectedRapidFireCount : resolvedMode === "coaching" ? 6 : undefined),
    };
    if (!modes.length) { setError("No practice modes are currently available."); return; }
    if (owner.current !== account) return;
    launching.current = true; setBusy(true); setError("");
    try {
      const connectivity = await NetInfo.fetch();
      if (!connectivity.isConnected) throw new Error("An internet connection is required to start a live session.");
      if (owner.current !== account) return;
      const result = await request<{ session: { id: string }; executionConfig: unknown; snapshot?: SessionSetupSnapshot }>("/api/mobile/v1/interview/sessions", { body: JSON.stringify({ snapshot }), method: "POST" });
      if (owner.current !== account) return;
      const executionConfig = interviewExecutionConfigSchema.parse(result.executionConfig);
      if (executionConfig.configured.modeKey !== snapshot.modeKey || !executionConfig.effective.enabled) throw new Error("The selected practice mode is no longer available.");
      // The server resolves and owns the controlled-mode version. The current
      // mobile response returns its immutable execution snapshot rather than a
      // duplicate setup snapshot, so retain the version only when its pinned
      // controlled-mode prompt policy proves this is the supported flow.
      const controlledMode = (snapshot.modeKey === "first_impression" || snapshot.modeKey === "rapid_fire")
        && executionConfig.effective.engine === "turn_based"
        && executionConfig.promptVersions.some((prompt) => prompt.version === 1 && prompt.key === `${snapshot.modeKey}_controlled`);
      const authoritativeRapidFireCount = snapshot.modeKey === "rapid_fire"
        ? Math.min(result.snapshot?.rapidFireQuestionCount ?? snapshot.rapidFireQuestionCount ?? 1, executionConfig.effective.maxTurns)
        : undefined;
      setActiveSession({ id: result.session.id, snapshot: {
        ...(result.snapshot ?? snapshot),
        ...(authoritativeRapidFireCount ? { rapidFireQuestionCount: authoritativeRapidFireCount, turnBasedQuestionCount: authoritativeRapidFireCount } : {}),
        executionConfig,
        ...(controlledMode ? { controlledModeVersion: 1 as const } : {}),
      } });
      await queryClient.invalidateQueries({ queryKey: bootstrapQueryKey });
      router.push("/session");
    } catch (cause) { if (owner.current === account) setError(cause instanceof Error ? cause.message : "The session could not be created."); }
    finally { launching.current = false; if (owner.current === account) setBusy(false); }
  };

  return <Screen bottomInset={false} eyebrow="QuesIQ Interview" subtitle="Choose your focus. Practice one honest answer at a time." title="Practice" trailing={<Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push("/(tabs)/me")} style={choiceStyles.profile}><Text style={choiceStyles.profileText}>{(data.profile?.preferredName || data.user.name || "Me").slice(0, 2).toUpperCase()}</Text></Pressable>}>
    <Button label="Saved questions and Practice next" variant="secondary" onPress={() => router.push("/questions")} />
    {includeRecommendation && params.recommendationId ? <Card title="Suggested practice"><Text style={choiceStyles.detail}>The saved suggestion and its exact question will be checked again when you start. Changing target or mode switches to your own setup.</Text><Button label="Choose my own practice" variant="secondary" onPress={() => { setIncludeRecommendation(false); setIncludeQuestions(false); }} /></Card> : null}
    {selectedIds.length ? <Card title="Selected questions"><Text style={choiceStyles.detail}>{selectedIds.length} exact question{selectedIds.length === 1 ? "" : "s"} · {params.queueTarget === "general" ? "General practice" : chosenTarget?.label || "Active target"}. {resolvedMode === "coaching" ? "Coaching supports one exact question." : "Run the ordered set in Rapid Fire."}</Text><Button label="Use ordinary practice instead" variant="secondary" onPress={() => setIncludeQuestions(false)} /></Card> : null}
    <Card title="1. Target role">
      {data.jobTargets.length ? data.jobTargets.map((target) => <Choice active={chosenTarget?.id === target.id} detail={target.targetCompany} key={target.id} label={target.targetRole} onPress={() => void activateTarget(target.id)} />) : <Text style={choiceStyles.detail}>Choose a target in Me, or start general practice without preparation.</Text>}
      <Button disabled={busy} label="General practice / no target" onPress={() => void activateTarget(null)} variant="secondary" />
    </Card>
    <Card title="2. Practice mode">{modes.length ? modes.map((item) => <Choice active={resolvedMode === item.key} detail={item.description} key={item.key} label={item.name} onPress={() => { setMode(item.key); setIncludeRecommendation(false); }} />) : <Text style={choiceStyles.detail}>No practice modes are currently available.</Text>}</Card>
    {selectedMode?.questionTypeRequired ? <Card title="3. Question focus"><View style={choiceStyles.chips}>{questionTypes.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: resolvedQuestionType === item.key }} key={item.key} onPress={() => setQuestionType(item.key)} style={[choiceStyles.chip, resolvedQuestionType === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, resolvedQuestionType === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card> : null}
    {resolvedMode === "rapid_fire" ? <Card title={`${selectedMode?.questionTypeRequired ? 4 : 3}. Rapid Fire questions`}><View style={choiceStyles.chips}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <Pressable accessibilityLabel={`${count} questions`} accessibilityRole="radio" accessibilityState={{ checked: selectedRapidFireCount === count }} key={count} onPress={() => setRapidFireQuestionCount(count)} style={[choiceStyles.chip, selectedRapidFireCount === count && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, selectedRapidFireCount === count && choiceStyles.chipTextActive]}>{count}</Text></Pressable>)}</View></Card> : null}
    <Card title={`${3 + (selectedMode?.questionTypeRequired ? 1 : 0) + (resolvedMode === "rapid_fire" ? 1 : 0)}. Interviewer style`}><View style={choiceStyles.chips}>{stylesList.map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: resolvedStyle === item.key }} key={item.key} onPress={() => setStyle(item.key)} style={[choiceStyles.chip, resolvedStyle === item.key && choiceStyles.chipActive]}><Text style={[choiceStyles.chipText, resolvedStyle === item.key && choiceStyles.chipTextActive]}>{item.label}</Text></Pressable>)}</View></Card>
    <Card accent="cyan" title="Ready when you are"><Text style={choiceStyles.summary}>{selectedMode?.name || "Select an available mode"}{chosenTarget?.targetRole ? ` · ${chosenTarget.targetRole}` : ""}</Text><Text style={choiceStyles.detail}>Your first question is prepared after you start. Microphone access is requested in the live session; you can end and save at any time.</Text>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: useSavedStories }} onPress={() => setUseSavedStories(!useSavedStories)} style={choiceStyles.chip}><Text style={choiceStyles.chipText}>Use saved stories: {useSavedStories ? "On" : "Off"}</Text></Pressable>
      {materials.isFetching ? <Text style={choiceStyles.detail}>Checking included material…</Text> : materials.isError ? <Text accessibilityRole="alert" style={choiceStyles.error}>Included material could not be checked. Retry or remove the selection.</Text> : materials.data?.materials.map(item => <Text key={item.id} style={choiceStyles.detail}>Included: {item.title} · revision {item.revision}</Text>)}
      {(params.storyId || params.introductionId) && includeSelected ? <Button label="Remove selected material" variant="secondary" onPress={() => setIncludeSelected(false)} /> : null}
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
