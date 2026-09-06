import type { SessionHistorySummary } from "@quesiq/interview-contracts";
import { router } from "expo-router";
import { ArrowRight, CalendarDays, CheckCircle2, Timer } from "lucide-react-native";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { reviewError, useHistory } from "@/lib/review-history";
import { colors, spacing } from "@/theme/tokens";

const labels = { coaching: "Coaching", first_impression: "First Impression", mock_interview: "Mock Interview", rapid_fire: "Rapid Fire" } as const;
function statusText(session: SessionHistorySummary) { if (session.evaluationStatus === "completed") return "Review ready"; if (session.evaluationStatus === "too_short") return "Saved · too short to score"; if (session.evaluationStatus === "failed") return "Saved · review needs attention"; if (session.evaluationStatus === "pending" || session.evaluationStatus === "processing") return "Review in progress"; return "Saved"; }

export default function HistoryScreen() {
  const history = useHistory(); const sessions = history.data?.pages.flatMap((page) => page.sessions) ?? [];
  if (history.isLoading) return <LoadingState label="Loading saved reviews…" />;
  if (history.isError && !history.data) return <ErrorState message={reviewError(history.error)} onRetry={() => history.refetch()} />;
  return <Screen bottomInset={false} eyebrow="Your progress" subtitle="Saved transcripts and coaching reviews. QuesIQ does not retain raw session audio." title="History" refreshControl={<RefreshControl colors={[colors.cyan]} onRefresh={() => history.refetch()} refreshing={history.isRefetching} tintColor={colors.cyan} />}>
    {history.isError ? <Text accessibilityRole="alert" style={styles.emptyBody}>{reviewError(history.error)} Your loaded reviews are still shown below.</Text> : null}
    {sessions.length ? sessions.map((session) => <HistoryCard key={session.id} session={session} />) : <Card><Text style={styles.emptyTitle}>Your first review will appear here.</Text><Text style={styles.emptyBody}>Start a practice session, speak naturally, and save it when you are finished.</Text></Card>}
    {history.hasNextPage ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: history.isFetchingNextPage, busy: history.isFetchingNextPage }} accessibilityLabel="Load more saved reviews" disabled={history.isFetchingNextPage} onPress={() => history.fetchNextPage()} style={styles.loadMore}><Text style={styles.loadMoreText}>{history.isFetchingNextPage ? "Loading more…" : "Load more reviews"}</Text></Pressable> : null}
  </Screen>;
}
function HistoryCard({ session }: { session: SessionHistorySummary }) { const completed = session.evaluationStatus === "completed"; return <Card onPress={() => router.push(`/review/${session.id}`)} trailing={<ArrowRight color={colors.cyan} size={20} />} title={labels[session.modeKey]}><Text style={styles.role}>{session.targetRole}{session.targetCompany ? ` · ${session.targetCompany}` : ""}</Text><View style={styles.meta}><View style={styles.metaItem}><CalendarDays color={colors.muted} size={15} /><Text style={styles.metaText}>{new Date(session.createdAt).toLocaleDateString()}</Text></View><View style={styles.metaItem}><Timer color={colors.muted} size={15} /><Text style={styles.metaText}>{session.durationSeconds ? `${Math.round(session.durationSeconds / 60)} min` : "Not completed"}</Text></View></View><View style={[styles.status, completed && styles.statusComplete]}><CheckCircle2 color={completed ? colors.lime : colors.muted} size={15} /><Text style={[styles.statusText, completed && styles.statusTextComplete]}>{statusText(session)}</Text></View></Card>; }
const styles = StyleSheet.create({ emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21 }, emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" }, loadMore: { alignItems: "center", borderColor: colors.border, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 48, padding: spacing.sm }, loadMoreText: { color: colors.cyan, fontSize: 15, fontWeight: "800" }, meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md }, metaItem: { alignItems: "center", flexDirection: "row", gap: spacing.xs }, metaText: { color: colors.muted, fontSize: 13 }, role: { color: colors.textSoft, fontSize: 14, lineHeight: 20 }, status: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.panelStrong, borderRadius: 99, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, statusComplete: { backgroundColor: colors.limeDark }, statusText: { color: colors.muted, fontSize: 12, fontWeight: "800" }, statusTextComplete: { color: colors.lime } });
