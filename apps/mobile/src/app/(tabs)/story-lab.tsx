import { randomUUID } from "expo-crypto";
import { materialFieldsSchema, storyCategories, type LabMaterial, type MaterialFields } from "@quesiq/interview-contracts";
import { router, useNavigation } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { parseApiResponse } from "@/lib/api";
import { useBootstrap } from "@/lib/bootstrap";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type Kind = "story" | "introduction";
type Lab = { stories: LabMaterial[]; introductions: LabMaterial[] };
type Editor = { id: string; revision: number; kind: Kind; fields: MaterialFields; reviewed: boolean; aiAssisted: boolean };
const label = (value: string) => value.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
const blank = () => materialFieldsSchema.parse({ title: "Untitled" });

export default function StoryLab() {
  const { user } = useAuth();
  return <LabScreen key={user?.id || "signed-out"} account={user?.id || ""} />;
}
function LabScreen({ account }: { account: string }) {
  const { fetchWithAuth } = useAuth(); const bootstrap = useBootstrap(); const cache = useQueryClient(); const nav = useNavigation();
  const mounted = useRef(true); const locked = useRef(false); const bypass = useRef(false);
  const draftRequest = useRef<{ id: string; source: string } | undefined>(undefined);
  const [hasDraftRequest, setHasDraftRequest] = useState(false);
  const [kind, setKind] = useState<Kind>("story"); const [editor, setEditor] = useState<Editor>();
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [draft, setDraft] = useState<Partial<MaterialFields>>();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const lab = useQuery<Lab>({ enabled: Boolean(account), queryKey: ["mobile-story-lab", account], queryFn: () => fetchWithAuth("/api/mobile/v1/interview/story-lab").then(parseApiResponse<Lab>) });
  const confirmDiscard = (next: () => void) => {
    if (locked.current) return;
    if (!editor) { next(); return; }
    Alert.alert("Discard unsaved material?", "Your saved library will stay unchanged.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: next }]);
  };
  useEffect(() => nav.addListener("beforeRemove", event => {
    if (!editor || bypass.current) return;
    event.preventDefault();
    if (locked.current) return;
    Alert.alert("Discard unsaved material?", "Your saved library will stay unchanged.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => { bypass.current = true; nav.dispatch(event.data.action); } }]);
  }), [editor, nav]);
  // A tab switch normally retains its screen, so no draft is discarded on blur.
  const close = (nextKind = kind) => confirmDiscard(() => { setEditor(undefined); setDraft(undefined); setKind(nextKind); draftRequest.current = undefined; setError(""); });
  const start = (item?: LabMaterial, duplicate = false) => confirmDiscard(() => {
    setEditor({ id: !item || duplicate ? randomUUID() : item.id, revision: duplicate ? 0 : item?.revision ?? 0, kind: item?.kind ?? kind,
      fields: item ? materialFieldsSchema.parse({ ...item, title: duplicate ? (item.title + " (copy)").slice(0, 200) : item.title }) : { ...blank(), title: "" },
      reviewed: Boolean(item?.reviewedAt), aiAssisted: item?.aiAssisted ?? false });
    setDraft(undefined); setError(""); draftRequest.current = undefined; setHasDraftRequest(false);
  });
  const run = async (operation: () => Promise<void>) => {
    if (locked.current) return; locked.current = true; setBusy(true); setError("");
    try { await operation(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "The request failed. Your draft is still here."); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const save = () => run(async () => {
    if (!editor) return;
    const parsed = materialFieldsSchema.safeParse(editor.fields);
    if (!parsed.success) throw new Error("Add a title and shorten any oversized fields before saving.");
    if (!editor.reviewed) throw new Error("Review the material before saving it for practice.");
    const next = await fetchWithAuth("/api/mobile/v1/interview/story-lab", { method: "PUT", body: JSON.stringify({ ...editor, fields: parsed.data }) }).then(parseApiResponse<LabMaterial>);
    if (!mounted.current) return;
    const key = editor.kind === "story" ? "stories" : "introductions";
    cache.setQueryData<Lab>(["mobile-story-lab", account], old => ({ ...(old ?? { stories: [], introductions: [] }), [key]: [next, ...(old?.[key] ?? []).filter(item => item.id !== next.id)] }));
    await cache.invalidateQueries({ queryKey: ["mobile-practice-material", account] });
    if (mounted.current) { setEditor(undefined); setDraft(undefined); }
  });
  const remove = (item: LabMaterial) => {
    if (locked.current) return;
    Alert.alert("Delete this material?", "Future practice will exclude it. Historical session copies remain.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => void run(async () => {
      await fetchWithAuth("/api/mobile/v1/interview/story-lab", { method: "DELETE", body: JSON.stringify({ id: item.id, kind: item.kind, revision: item.revision }) }).then(parseApiResponse);
      if (mounted.current) { await lab.refetch(); await cache.invalidateQueries({ queryKey: ["mobile-practice-material", account] }); }
    }) }]);
  };
  const generate = () => run(async () => {
    if (!editor) return;
    const fields = materialFieldsSchema.safeParse(editor.fields);
    if (!fields.success || !fields.data.rawNotes.trim()) throw new Error("Add a title and original notes before requesting a draft.");
    const targetId = bootstrap.data?.profile?.jobTargetId;
    const source = JSON.stringify({ kind: editor.kind, fields: fields.data, revision: editor.revision, targetId });
    if (draftRequest.current && draftRequest.current.source !== source) throw new Error("Your notes or target changed. Choose New draft request to explicitly start a different request.");
    draftRequest.current ??= { id: randomUUID(), source };
    setHasDraftRequest(true);
    const next = await fetchWithAuth("/api/mobile/v1/interview/story-lab/draft", { method: "POST", body: JSON.stringify({ id: draftRequest.current.id, kind: editor.kind, revision: editor.revision, fields: fields.data, targetId }) }).then(parseApiResponse<{ fields: Partial<MaterialFields> }>);
    if (mounted.current) setDraft(next.fields);
  });
  const accept = () => {
    if (!editor || !draft || busy) return;
    const parsed = materialFieldsSchema.safeParse({ ...editor.fields, ...draft, rawNotes: editor.fields.rawNotes });
    if (!parsed.success) { setError("The draft could not be applied. Your original material is unchanged."); return; }
    setEditor({ ...editor, fields: parsed.data, reviewed: false, aiAssisted: true }); setDraft(undefined);
  };
  const change = <K extends keyof MaterialFields>(key: K, value: MaterialFields[K]) => {
    if (!busy) setEditor(current => current ? { ...current, fields: { ...current.fields, [key]: value } } : current);
  };
  if (lab.isLoading) return <LoadingState />;
  if (lab.isError || !lab.data) return <ErrorState message="Story Lab could not be loaded." onRetry={() => lab.refetch()} />;
  const visible = (kind === "story" ? lab.data.stories : lab.data.introductions).filter(item => (item.title + " " + item.rawNotes).toLowerCase().includes(query.toLowerCase()) && (kind !== "story" || category === "all" || item.categories.includes(category as typeof storyCategories[number])));
  return <Screen eyebrow="Practice material" keyboardAvoiding title="Story Lab" subtitle="Write facts first. AI drafting is optional.">
    <View style={styles.row}><Button disabled={busy} label="Introductions" onPress={() => close("introduction")} variant="secondary" /><Button disabled={busy} label="Stories" onPress={() => close("story")} variant="secondary" /></View>
    {editor ? <Card title={editor.revision ? "Edit material" : "New " + editor.kind}>
      <Field label="Title" value={editor.fields.title} maxLength={200} onChangeText={value => change("title", value)} editable={!busy} />
      <Field label="Original notes" value={editor.fields.rawNotes} onChangeText={value => change("rawNotes", value)} editable={!busy} multiline />
      {(editor.kind === "story" ? [["situation", "Situation"], ["task", "Task"], ["result", "Result"], ["summary", "Summary"], ["practicePrompt", "Reviewed practice question"]] : [["script", "Introduction text"], ["background", "Background"], ["strength", "Strength"], ["proofPoint", "Example"], ["roleInterest", "Role interest"], ["transition", "Closing transition"]]).map(([key, name]) => <Field key={key} label={name} value={String(editor.fields[key as keyof MaterialFields])} onChangeText={value => change(key as keyof MaterialFields, value)} editable={!busy} multiline />)}
      {editor.kind === "story" ? <>
        <Field label="Actions (one per line)" value={editor.fields.actions.join("\n")} onChangeText={value => change("actions", value.split("\n"))} editable={!busy} multiline />
        <Text style={styles.support}>Categories organize practice; they are not competency ratings.</Text><View style={styles.row}>{storyCategories.map(key => <Button key={key} disabled={busy} label={(editor.fields.categories.includes(key) ? "✓ " : "") + label(key)} onPress={() => change("categories", editor.fields.categories.includes(key) ? editor.fields.categories.filter(x => x !== key) : [...editor.fields.categories, key])} variant="secondary" />)}</View>
      </> : <><Text style={styles.label}>Audience</Text><View style={styles.row}>{(["virtual", "hr_phone", "in_person"] as const).map(value => <Button disabled={busy} key={value} label={(editor.fields.audience === value ? "✓ " : "") + label(value)} onPress={() => change("audience", value)} variant="secondary" />)}</View><Text style={styles.label}>Length</Text><View style={styles.row}>{(["short", "medium", "long"] as const).map(value => <Button disabled={busy} key={value} label={(editor.fields.length === value ? "✓ " : "") + label(value)} onPress={() => change("length", value)} variant="secondary" />)}</View></>}
      <Button disabled={busy} label={editor.reviewed ? "Reviewed: yes" : "I reviewed this material"} onPress={() => setEditor({ ...editor, reviewed: !editor.reviewed })} variant="secondary" />
      <Button disabled={busy || !editor.reviewed || !editor.fields.title.trim()} label="Save reviewed material" onPress={() => void save()} />
      <Button disabled={busy || !editor.fields.rawNotes.trim()} label="Help me draft" onPress={() => void generate()} variant="secondary" />
      <Text style={styles.support}>Saving uses no AI. Drafting may use the configured AI provider; missing facts must stay missing. {editor.aiAssisted ? "This material is AI-assisted." : ""}</Text>
      {hasDraftRequest ? <Button disabled={busy} label="New draft request" variant="secondary" onPress={() => Alert.alert("Start a new AI request?", "A previous uncertain request may already have incurred usage. This explicitly allows a new request.", [{ text: "Cancel", style: "cancel" }, { text: "New request", onPress: () => { draftRequest.current = undefined; setHasDraftRequest(false); setDraft(undefined); setError(""); } }])} /> : null}
      {draft ? <Card title="Proposed draft"><Text style={styles.support}>Original notes remain above. Review the proposal before accepting.</Text>{Object.entries(draft).filter(([key]) => key !== "rawNotes").map(([key, value]) => <Text style={styles.support} key={key}>{label(key)}: {Array.isArray(value) ? value.join("; ") : String(value)}</Text>)}<Button disabled={busy} label="Accept draft" onPress={accept} /><Button disabled={busy} label="Discard draft" onPress={() => setDraft(undefined)} variant="secondary" /></Card> : null}
      <Button disabled={busy} label="Close editor" onPress={() => close()} variant="secondary" />
      <Button disabled={busy} label="Reload saved library (keep draft)" onPress={() => void lab.refetch()} variant="secondary" />
    </Card> : <>
      <Field label="Search library" value={query} onChangeText={setQuery} />
      {kind === "story" ? <View style={styles.row}>{["all", ...storyCategories].map(key => <Button disabled={busy} key={key} label={(category === key ? "✓ " : "") + label(key)} onPress={() => setCategory(key)} variant="secondary" />)}</View> : null}
      <Button disabled={busy} label={"Add " + kind} onPress={() => start()} />
      {!visible.length ? <Text style={styles.support}>No matching material yet.</Text> : null}
      {visible.map(item => <Card key={item.id} title={item.title}><Text style={styles.support}>{item.reviewedAt ? "Reviewed" : "Needs review"}{item.aiAssisted ? " · AI-assisted" : ""}</Text><Button disabled={busy} label="Edit" onPress={() => start(item)} variant="secondary" /><Button disabled={busy} label="Duplicate" onPress={() => start(item, true)} variant="secondary" /><Button disabled={busy} label="Delete" onPress={() => remove(item)} variant="danger" />{item.reviewedAt && (item.kind === "introduction" || item.practicePrompt.trim()) ? <Button disabled={busy} label={item.kind === "story" ? "Practice this story" : "Practice this introduction"} onPress={() => router.push(item.kind === "story" ? `/practice?storyId=${item.id}&mode=coaching` : `/practice?introductionId=${item.id}&mode=first_impression`)} /> : null}</Card>)}
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </Screen>;
}
function Field({ label: name, value, onChangeText, multiline, editable = true, maxLength = 12000 }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; editable?: boolean; maxLength?: number }) {
  return <><Text style={styles.label}>{name}</Text><TextInput accessibilityLabel={name} maxLength={maxLength} editable={editable} multiline={multiline} onChangeText={onChangeText} style={[styles.input, multiline && styles.multi]} value={value} /></>;
}
const styles = StyleSheet.create({ error: { color: colors.danger }, input: { backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, minHeight: 48, padding: spacing.sm }, label: { color: colors.textSoft, fontWeight: "700" }, multi: { minHeight: 88, textAlignVertical: "top" }, row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, support: { color: colors.muted, lineHeight: 20 } });
