import type { PracticeRecommendation } from "@quesiq/interview-contracts";
import { router } from "expo-router";
import { ArrowRight, BriefcaseBusiness, Sparkles } from "lucide-react-native";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useBootstrap } from "@/lib/bootstrap";
import { preferredTargetId } from "@/lib/practice-catalog";
import { useRecommendationActions, useRecommendations, useProgress, useRefetchOnFocus } from "@/lib/useful-progress";
import { colors, spacing } from "@/theme/tokens";

export default function HomeScreen() {
  const { user } = useAuth();
  const bootstrap = useBootstrap();
  return <HomeContent key={`${user?.id ?? bootstrap.data?.user.id}:${bootstrap.data ? preferredTargetId(bootstrap.data) ?? "general" : "loading"}`} />;
}
function HomeContent() {
  const bootstrap = useBootstrap(); const targetId = bootstrap.data ? preferredTargetId(bootstrap.data) : undefined;
  const recommendations = useRecommendations("active", targetId); const progress = useProgress("active", "30", targetId); const { dismiss } = useRecommendationActions("active", recommendations.data?.targetId); const [dismissError, setDismissError] = useState(""); const [dismissing, setDismissing] = useState(false);
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useRefetchOnFocus(recommendations.refetch, bootstrap.data?.user.id); useRefetchOnFocus(progress.refetch, bootstrap.data?.user.id);
  if (bootstrap.isLoading) return <LoadingState />;
  if (!bootstrap.data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Your workspace could not be loaded."} onRetry={() => bootstrap.refetch()} />;
  const { jobTargets, profile, user } = bootstrap.data; const target = jobTargets.find((item) => item.id === targetId); const suggestions = recommendations.isError ? [] : recommendations.data?.suggestions ?? []; const primary = suggestions[0];
  const skip = async (item: PracticeRecommendation) => { if (dismissing) return; setDismissing(true); setDismissError(""); try { await dismiss(item); } catch (cause) { if (mounted.current) setDismissError(cause instanceof Error ? cause.message : "Could not hide this suggestion. Try again."); } finally { if (mounted.current) setDismissing(false); } };
  return <Screen bottomInset={false} eyebrow="QuesIQ Interview" subtitle="One focused conversation at a time." title={`Ready, ${profile?.preferredName || user.name || "there"}`} refreshControl={<RefreshControl colors={[colors.cyan]} onRefresh={() => { void Promise.all([recommendations.refetch(), progress.refetch()]); }} refreshing={recommendations.isRefetching || progress.isRefetching} tintColor={colors.cyan} />}>
    {recommendations.isError ? <Text accessibilityRole="alert" style={styles.error}>Suggestions are unavailable. You can still choose your own practice.</Text> : null}
    {primary ? <RecommendationCard item={primary} primary onChoose={() => launchRecommendation(primary, recommendations.data?.targetId ?? null)} onSkip={() => void skip(primary)} disabled={dismissing} /> : <Card accent="cyan"><View style={styles.row}><View style={styles.icon}><Sparkles color={colors.cyan} size={21} /></View><View style={styles.copy}><Text style={styles.kicker}>PRACTICE NEXT</Text><Text style={styles.cardTitle}>Choose a focus for your next answer.</Text><Text style={styles.body}>{recommendations.isLoading ? "Finding a useful next step…" : "No suggestion is available yet. Your saved work is unchanged."}</Text></View></View></Card>}
    <Button label="Choose myself" variant="secondary" onPress={() => launchOrdinary(targetId)} />
    {suggestions.slice(1, 3).map((item) => <RecommendationCard key={item.id} item={item} onChoose={() => launchRecommendation(item, recommendations.data?.targetId ?? null)} onSkip={() => void skip(item)} disabled={dismissing} />)}
    {dismissError ? <Text accessibilityRole="alert" style={styles.error}>{dismissError}</Text> : null}
    <Card onPress={() => router.push("/(tabs)/me")} title="Active target" trailing={<BriefcaseBusiness color={colors.lime} size={20} />}><Text style={styles.cardTitle}>{target?.targetRole || "Choose a target"}</Text><Text style={styles.body}>{target?.targetCompany || "General practice is available without a target."}</Text><Text style={styles.link}>Edit target in Me <ArrowRight color={colors.cyan} size={15} /></Text></Card>
    <Card title="Last 30 days"><View style={styles.metrics}><Metric value={progress.data?.counts?.sessions} label="sessions" /><Metric value={progress.data?.counts?.initialAnswers} label="independent answers" /><Metric value={progress.data?.counts?.subsequentAttempts} label="follow-up attempts" /></View><Pressable accessibilityRole="button" accessibilityLabel="View progress" onPress={() => router.push("/progress")} style={styles.progressLink}><Text style={styles.link}>View progress</Text><ArrowRight color={colors.cyan} size={16} /></Pressable></Card>
    {progress.isError ? <Text accessibilityRole="alert" style={styles.error}>Progress could not load. Pull to refresh and try again.</Text> : null}
  </Screen>;
}
function Metric({ value, label }: { value?: number; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value === undefined ? "—" : value}</Text><Text style={styles.caption}>{label}</Text></View>; }
function RecommendationCard({ item, primary, onChoose, onSkip, disabled }: { item: PracticeRecommendation; primary?: boolean; onChoose: () => void; onSkip: () => void; disabled?: boolean }) { return <Card accent={primary ? "cyan" : undefined} title={primary ? "Recommended next" : item.action}><Text style={styles.cardTitle}>{item.action}</Text><Text style={styles.body}>{item.reason}</Text>{item.questionText ? <Text style={styles.body}>Question: {item.questionText}</Text> : null}<Text style={styles.target}>{item.targetLabel} · {item.mode.replace("_", " ")}</Text>{item.evidence ? <Pressable accessibilityRole="button" accessibilityLabel="Open source review" onPress={() => router.push(`/review/${item.evidence!.sessionId}?turnIndex=${item.evidence!.turnIndex}&attemptId=${item.evidence!.attemptId}`)} style={styles.source}><Text style={styles.link}>Open source review</Text><ArrowRight color={colors.cyan} size={15} /></Pressable> : null}<View style={styles.actions}><Button disabled={disabled} label="Practice this" onPress={onChoose} /><Button disabled={disabled} label="Show another" variant="secondary" onPress={onSkip} /></View></Card>; }
function launchRecommendation(item: PracticeRecommendation, responseTargetId: string | null) { router.push({ pathname: "/(tabs)/practice", params: { mode: item.mode, recommendationId: item.id, recommendationTarget: responseTargetId || "general", queueTarget: item.targetId || "general" } }); }
function launchOrdinary(targetId?: string) { router.push({ pathname: "/(tabs)/practice", params: { mode: "coaching", queueTarget: targetId || "general" } }); }
const styles = StyleSheet.create({ actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, body: { color: colors.muted, fontSize: 14, lineHeight: 20 }, caption: { color: colors.muted, fontSize: 12 }, cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800", lineHeight: 23 }, copy: { flex: 1, gap: spacing.xs }, error: { color: colors.danger, fontSize: 14, lineHeight: 20 }, icon: { alignItems: "center", backgroundColor: colors.cyanDark, borderRadius: 16, height: 46, justifyContent: "center", width: 46 }, kicker: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }, link: { color: colors.cyan, fontSize: 13, fontWeight: "800" }, metric: { flex: 1, minWidth: 90 }, metricValue: { color: colors.text, fontSize: 24, fontWeight: "900" }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, progressLink: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 48 }, row: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md }, source: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 48 }, target: { color: colors.textSoft, fontSize: 13, textTransform: "capitalize" } });
