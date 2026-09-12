import { type QuestionPreferences, type SavedQuestion } from "@quesiq/interview-contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useBootstrap } from "@/lib/bootstrap";
import { useAuth } from "@/providers/auth-provider";
import { colors, spacing } from "@/theme/tokens";

export default function QuestionsScreen() { const { user } = useAuth(); return <QuestionsForm key={user?.id ?? "signed-out"} />; }
function QuestionsForm() {
  const { request, user } = useAuth(); const cache = useQueryClient(); const bootstrap = useBootstrap();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [general, setGeneral] = useState(false); const [text, setText] = useState(""); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const alive = useRef(true); const lock = useRef(false); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const queryKey = ["mobile-question-preferences", user?.id];
  const query = useQuery({ enabled: Boolean(user?.id), queryKey, queryFn: () => request<QuestionPreferences>("/api/mobile/v1/interview/questions") });
  const refetchQuestions = query.refetch;
  useFocusEffect(useCallback(() => {
    const focusedUserId = user?.id;
    if (!focusedUserId || !alive.current || focusedUserId !== user?.id) return undefined;
    void refetchQuestions();
    return undefined;
  }, [refetchQuestions, user?.id]));
  const sessionQuestions = useQuery({ enabled: Boolean(user?.id && params.sessionId), queryKey: ["mobile-session-questions", user?.id, params.sessionId], queryFn: () => request<{ questions: string[] }>(`/api/mobile/v1/interview/questions?sessionId=${params.sessionId}`) });
  const targetId = general ? null : bootstrap.data?.profile?.jobTargetId ?? null;
  const queue = query.data?.queues.find(item => item.targetId === targetId) ?? { ids: [], revision: 0, targetId };
  const mutate = async (change: unknown, clearText = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    try { const next = await request<QuestionPreferences>("/api/mobile/v1/interview/questions", { method: "PUT", body: JSON.stringify(change) }); if (alive.current) { cache.setQueryData(queryKey, next); if (clearText) setText(""); await cache.invalidateQueries({ queryKey: ["mobile-recommendations", user?.id] }); } }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Questions could not be saved. Your text is still here."); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const updateQueue = (ids: string[]) => void mutate({ action: "queue", targetId, revision: queue.revision, ids });
  const launch = (ids: string[], mode: "coaching" | "rapid_fire") => router.push({ pathname: "/(tabs)/practice", params: { questionIds: ids.join(","), mode, queueTarget: targetId ?? "general" } });
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message="Saved questions could not load." onRetry={() => query.refetch()} />;
  const data = query.data; const all = new Map([...data.bank, ...data.saved].map(item => [item.id, item]));
  const reorder = (index: number, delta: number) => { const ids = [...queue.ids]; [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]]; updateQueue(ids); };
  const controls = (question: SavedQuestion) => <>
    <Text style={styles.body}>{question.text}</Text>{!question.available ? <Text style={styles.error}>Unavailable for new practice. Saved text is retained.</Text> : null}
    <Button disabled={busy} label={data.saved.some(item => item.id === question.id) ? "Remove bookmark" : "Save question"} variant="secondary" onPress={() => void mutate({ action: data.saved.some(item => item.id === question.id) ? "unsave" : "save", questionId: question.id })} />
    <Button disabled={busy || (!queue.ids.includes(question.id) && (!question.available || queue.ids.length >= 10))} label={queue.ids.includes(question.id) ? "Remove from Practice next" : "Practice next"} variant="secondary" onPress={() => updateQueue(queue.ids.includes(question.id) ? queue.ids.filter(id => id !== question.id) : [...queue.ids, question.id])} />
    <Button disabled={busy || !question.available || !question.compatibleModes.includes("coaching")} label="Practice with coaching" onPress={() => launch([question.id], "coaching")} />
  </>;
  return <Screen title="Saved questions" eyebrow="Practice" keyboardAvoiding subtitle="Bookmarks stay saved after practice. Practice next clears only answered questions.">
    <Button disabled={busy} label="Refresh saved questions" variant="secondary" onPress={() => void query.refetch()} />
    <Card title="Practice next"><View style={styles.row}><Button disabled={busy} label="Active target" onPress={() => setGeneral(false)} variant="secondary" /><Button disabled={busy} label="General practice" onPress={() => setGeneral(true)} variant="secondary" /></View><Text style={styles.body}>{targetId ? bootstrap.data?.jobTargets.find(item => item.id === targetId)?.label : "General practice"} · {queue.ids.length}/10</Text>
      {queue.ids.map((id, index) => <View key={id} style={styles.item}><Text style={styles.body}>{index + 1}. {all.get(id)?.text ?? "Unavailable question"}</Text><View style={styles.row}><Button disabled={busy || index === 0} label={`Move question ${index + 1} up`} variant="secondary" onPress={() => reorder(index, -1)} /><Button disabled={busy || index === queue.ids.length - 1} label={`Move question ${index + 1} down`} variant="secondary" onPress={() => reorder(index, 1)} /><Button disabled={busy} label={`Remove question ${index + 1}`} variant="secondary" onPress={() => updateQueue(queue.ids.filter(value => value !== id))} /></View></View>)}
      <Button disabled={busy || !queue.ids.length || queue.ids.some(id => !all.get(id)?.available || !all.get(id)?.compatibleModes.includes("rapid_fire"))} label="Run question set" onPress={() => launch(queue.ids, "rapid_fire")} />
      <Button disabled={busy || !queue.ids.length} label="Clear Practice next" variant="secondary" onPress={() => Alert.alert("Clear Practice next?", "Bookmarks will remain saved.", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: () => updateQueue([]) }])} />
    </Card>
    {params.sessionId ? <Card title="Questions from this session">{sessionQuestions.isError ? <Text style={styles.error}>Owned session questions could not load.</Text> : sessionQuestions.data?.questions.map((question, questionIndex) => <View key={questionIndex} style={styles.item}><Text style={styles.body}>{question}</Text><Button disabled={busy} label={`Save session question ${questionIndex + 1}`} onPress={() => void mutate({ action: "from_session", sessionId: params.sessionId, questionIndex })} /></View>)}</Card> : null}
    <Card title="Your own question"><TextInput accessibilityLabel="Custom question" editable={!busy} multiline maxLength={2000} style={styles.input} value={text} onChangeText={setText} /><Button disabled={busy || text.trim().length < 5} label="Save custom question" onPress={() => void mutate({ action: "custom", text }, true)} /></Card>
    <Card title="Bookmarks">{data.saved.length ? data.saved.map(question => <View key={question.id} style={styles.item}>{controls(question)}</View>) : <Text style={styles.body}>No bookmarks yet.</Text>}</Card>
    <Card title="Question bank"><TextInput accessibilityLabel="Search questions" style={styles.input} value={search} onChangeText={setSearch} />{data.bank.filter(item => item.text.toLowerCase().includes(search.toLowerCase())).slice(0, 30).map(question => <View key={question.id} style={styles.item}>{controls(question)}</View>)}</Card>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </Screen>;
}
const styles = StyleSheet.create({ body: { color: colors.textSoft, lineHeight: 21 }, error: { color: colors.danger }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, item: { borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md, gap: spacing.sm }, input: { backgroundColor: colors.backgroundRaised, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: 12, padding: spacing.md, minHeight: 52 } });
