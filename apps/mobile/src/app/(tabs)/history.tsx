import { router } from "expo-router";
import { ArrowRight, CalendarDays, CheckCircle2, Timer } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useBootstrap } from "@/lib/bootstrap";
import { colors, spacing } from "@/theme/tokens";

const labels = { coaching: "Coaching", first_impression: "First Impression", mock_interview: "Mock Interview", rapid_fire: "Rapid Fire" } as const;

export default function HistoryScreen() {
  const bootstrap = useBootstrap();
  if (bootstrap.isLoading) return <LoadingState />;
  if (!bootstrap.data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "History could not be loaded."} onRetry={() => bootstrap.refetch()} />;
  return <Screen eyebrow="Your progress" subtitle="Saved transcripts and coaching reviews. QuesIQ does not retain raw session audio." title="History">
    {bootstrap.data.sessions.length ? bootstrap.data.sessions.map((session) => <Card key={session.id} onPress={() => router.push(`/review/${session.id}`)} trailing={<ArrowRight color={colors.cyan} size={20} />} title={labels[session.modeKey]}>
      <Text style={styles.role}>{session.targetRole}{session.targetCompany ? ` · ${session.targetCompany}` : ""}</Text>
      <View style={styles.meta}><View style={styles.metaItem}><CalendarDays color={colors.muted} size={15} /><Text style={styles.metaText}>{new Date(session.createdAt).toLocaleDateString()}</Text></View><View style={styles.metaItem}><Timer color={colors.muted} size={15} /><Text style={styles.metaText}>{session.durationSeconds ? `${Math.round(session.durationSeconds / 60)} min` : "Not completed"}</Text></View></View>
      <View style={[styles.status, session.evaluationStatus === "completed" && styles.statusComplete]}><CheckCircle2 color={session.evaluationStatus === "completed" ? colors.lime : colors.muted} size={15} /><Text style={[styles.statusText, session.evaluationStatus === "completed" && styles.statusTextComplete]}>{session.evaluationStatus === "completed" ? "Review ready" : session.evaluationStatus === "too_short" ? "Saved · too short to score" : "Saved"}</Text></View>
    </Card>) : <Card><Text style={styles.emptyTitle}>Your first review will appear here.</Text><Text style={styles.emptyBody}>Start a practice session, speak naturally, and save it when you are finished.</Text></Card>}
  </Screen>;
}

const styles = StyleSheet.create({
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" }, meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, metaItem: { alignItems: "center", flexDirection: "row", gap: spacing.xs }, metaText: { color: colors.muted, fontSize: 13 }, role: { color: colors.textSoft, fontSize: 14, lineHeight: 20 },
  status: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.panelStrong, borderRadius: 99, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, statusComplete: { backgroundColor: colors.limeDark }, statusText: { color: colors.muted, fontSize: 12, fontWeight: "800" }, statusTextComplete: { color: colors.lime },
});
