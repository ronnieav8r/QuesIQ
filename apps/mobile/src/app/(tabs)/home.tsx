import { router } from "expo-router";
import { ArrowRight, BriefcaseBusiness, Sparkles, Target } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useBootstrap } from "@/lib/bootstrap";
import { colors, spacing } from "@/theme/tokens";

function average(scores: { score: number }[]) {
  return scores.length ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length * 20) : undefined;
}

export default function HomeScreen() {
  const bootstrap = useBootstrap();
  if (bootstrap.isLoading) return <LoadingState />;
  if (bootstrap.isError || !bootstrap.data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Your workspace could not be loaded."} onRetry={() => bootstrap.refetch()} />;
  const { jobTargets, profile, sessions, user } = bootstrap.data;
  const target = jobTargets.find((item) => item.id === profile?.jobTargetId) ?? jobTargets[0];
  const latest = sessions.find((session) => session.hasEvaluation);
  const score = latest?.evaluation ? average(latest.evaluation.scores) : undefined;

  return <Screen eyebrow="QuesIQ Interview" subtitle="One focused conversation at a time." title={`Ready, ${profile?.preferredName || user.name || "there"}?`}>
    <Card accent="cyan">
      <View style={styles.row}><View style={styles.icon}><Sparkles color={colors.cyan} size={21} /></View><View style={styles.copy}><Text style={styles.kicker}>QUICK PRACTICE</Text><Text style={styles.cardTitle}>Make your first 90 seconds count.</Text><Text style={styles.body}>Que will help you sharpen your introduction for this role.</Text></View></View>
      <Button icon={ArrowRight} label="Start First Impression" onPress={() => router.push({ pathname: "/(tabs)/practice", params: { mode: "first_impression" } })} />
    </Card>
    <Card title="Active target" trailing={<BriefcaseBusiness color={colors.lime} size={20} />}>
      <Text style={styles.cardTitle}>{target?.targetRole || profile?.targetRole || "Add a role to practice for"}</Text>
      <Text style={styles.body}>{target?.targetCompany || profile?.targetCompany || "Your practice will become more specific once a target is added."}</Text>
    </Card>
    <View style={styles.twoCol}>
      <Card accent="lime"><Target color={colors.lime} size={22} /><Text style={styles.metric}>{score ? `${score}%` : "—"}</Text><Text style={styles.caption}>Latest score</Text></Card>
      <Card><Text style={styles.metric}>{sessions.length}</Text><Text style={styles.caption}>Saved sessions</Text></Card>
    </View>
    {latest ? <Card onPress={() => router.push(`/review/${latest.id}`)} title="Continue your progress" trailing={<ArrowRight color={colors.cyan} size={20} />}><Text style={styles.body}>{latest.evaluation?.nextAction || "Open your latest review and choose the next skill to practice."}</Text></Card> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 }, cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800", lineHeight: 24 },
  caption: { color: colors.muted, fontSize: 13 }, copy: { flex: 1, gap: spacing.xs }, icon: { alignItems: "center", backgroundColor: colors.cyanDark, borderRadius: 16, height: 46, justifyContent: "center", width: 46 },
  kicker: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 }, metric: { color: colors.text, fontSize: 28, fontWeight: "900" }, row: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md }, twoCol: { flexDirection: "row", gap: spacing.sm },
});
