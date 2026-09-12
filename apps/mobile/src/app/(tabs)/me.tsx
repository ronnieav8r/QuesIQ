import type { InterviewContext, JobTarget, PreparationMutation } from "@quesiq/interview-contracts";
import * as DocumentPicker from "expo-document-picker";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useNavigation } from "expo-router";
import { FileText, LogOut, Plus, Save, Trash2, Upload } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { bootstrapQueryKey, useBootstrap } from "@/lib/bootstrap";
import { parseApiResponse } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { colors, radius, spacing } from "@/theme/tokens";

type PreparationState = { profile?: InterviewContext; revision: number; targets: JobTarget[] };
type ExtractedResume = { mimeType: string; name: string; originalCharacters: number; size: number; text: string; truncated: boolean };
type ResumeSummaryDraft = { draftId: string; summary: Record<string, unknown> };
const MAX_RESUME_CHARS = 12_000;

export default function MeScreen() {
  const bootstrap = useBootstrap();
  const { user } = useAuth();
  if (bootstrap.isLoading) return <LoadingState />;
  if (bootstrap.isError || !bootstrap.data) return <ErrorState message="Your profile could not be loaded." onRetry={() => bootstrap.refetch()} />;
  return <MeForm bootstrap={bootstrap.data} key={user?.id || bootstrap.data.user.id} />;
}

function MeForm({ bootstrap }: { bootstrap: { profile?: InterviewContext; user: { id: string; name?: string; email?: string } } }) {
  const { fetchWithAuth, signOut, user } = useAuth(); const queryClient = useQueryClient();
  const navigation = useNavigation(); const discardNavigation = useRef(false);
  const accountId = user?.id || bootstrap.user.id; const accountRef = useRef(accountId); const mountedRef = useRef(true); const busyRef = useRef(false); const summaryRequestIdRef = useRef<string | undefined>(undefined);
  const [editingTarget, setEditingTarget] = useState<JobTarget | null | undefined>(); const [preferredName, setPreferredName] = useState(bootstrap.profile?.preferredName || user?.name || "");
  const [targetRole, setTargetRole] = useState(""); const [targetCompany, setTargetCompany] = useState(""); const [jobDescription, setJobDescription] = useState("");
  const [resumeDraft, setResumeDraft] = useState<ExtractedResume | undefined>(); const [resumeText, setResumeText] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [stale, setStale] = useState(false); const [error, setError] = useState(false); const [summaryDraft, setSummaryDraft] = useState<ResumeSummaryDraft>();
  useEffect(() => { accountRef.current = accountId; mountedRef.current = true; return () => { mountedRef.current = false; }; }, [accountId]);
  const preparation = useQuery<PreparationState>({ enabled: Boolean(accountId), queryKey: ["mobile-interview-preparation", accountId], queryFn: async () => parseApiResponse<PreparationState>(await fetchWithAuth("/api/mobile/v1/interview/preparation")) });
  const state = preparation.data; const isBusy = busy || preparation.isFetching;
  const dirty = editingTarget !== undefined || Boolean(resumeDraft) || Boolean(resumeText.trim()) || preferredName !== (state?.profile?.preferredName || user?.name || "");
  useEffect(() => navigation.addListener("beforeRemove", (event) => { if (!dirty || discardNavigation.current) return; event.preventDefault(); Alert.alert("Discard unsaved changes?", "Your saved preparation will stay unchanged.", [{ style: "cancel", text: "Keep editing" }, { style: "destructive", text: "Discard", onPress: () => { discardNavigation.current = true; navigation.dispatch(event.data.action); } }]); }), [dirty, navigation]);
  const discardTarget = (next?: JobTarget) => Alert.alert("Discard unsaved target?", "This target draft has not been saved.", [{ style: "cancel", text: "Keep editing" }, { style: "destructive", text: "Discard", onPress: () => { setEditingTarget(next ?? undefined); setTargetRole(next?.targetRole || ""); setTargetCompany(next?.targetCompany || ""); setJobDescription(next?.jobDescription || ""); } }]);
  const beginTarget = (target?: JobTarget) => { if (editingTarget !== undefined && (target?.id !== editingTarget?.id || target === undefined)) { discardTarget(target); return; } setEditingTarget(target ?? null); setTargetRole(target?.targetRole || ""); setTargetCompany(target?.targetCompany || ""); setJobDescription(target?.jobDescription || ""); setMessage(""); setError(false); };
  const invalidate = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["mobile-interview-preparation", accountId] }), queryClient.invalidateQueries({ queryKey: bootstrapQueryKey })]); };
  const mutate = async (change: PreparationMutation["change"], success: string) => {
    if (!state || busyRef.current) return false; const owner = accountId; busyRef.current = true; setBusy(true); setMessage(""); setStale(false); setError(false);
    try {
      const response = await fetchWithAuth("/api/mobile/v1/interview/preparation", { body: JSON.stringify({ revision: state.revision, change }), method: "PUT" }); const next = await parseApiResponse<PreparationState>(response);
      if (accountRef.current !== owner || !mountedRef.current) return false; queryClient.setQueryData(["mobile-interview-preparation", owner], next); await invalidate(); setMessage(success); return true;
    } catch (cause) { if (accountRef.current !== owner || !mountedRef.current) return false; const text = cause instanceof Error ? cause.message : "Your draft could not be saved."; setMessage(text); setError(true); setStale((cause as { code?: string }).code === "stale_preparation"); return false; }
    finally { busyRef.current = false; if (accountRef.current === owner && mountedRef.current) setBusy(false); }
  };
  const reload = async () => { await preparation.refetch(); setStale(false); setMessage("Latest saved preparation loaded. Your draft is still in the fields."); };
  const saveTarget = () => void mutate({ action: "target_save", ...(editingTarget ? { id: editingTarget.id } : {}), jobDescription, targetCompany, targetRole }, editingTarget ? "Job target updated." : "Job target saved.").then((saved) => { if (saved) setEditingTarget(undefined); });
  const removeTarget = (target: JobTarget) => Alert.alert("Delete this job target?", "It will no longer be used for future practice. Historical session copies and reviews remain.", [{ style: "cancel", text: "Cancel" }, { style: "destructive", text: "Delete", onPress: () => void mutate({ action: "target_delete", id: target.id }, "Job target deleted.") }]);
  const reviewPaste = () => { const text = resumeText.trim(); if (!text) { setMessage("Paste resume text before reviewing it."); return; } setResumeDraft({ mimeType: "text/plain", name: "Pasted resume", originalCharacters: text.length, size: text.length, text, truncated: text.length > MAX_RESUME_CHARS }); };
  const reviewConfirmedResume = () => { const profile = state?.profile as (InterviewContext & { resumeMimeType?: string; resumeSize?: number }) | undefined; if (!profile?.resumeText) return; setResumeDraft({ mimeType: profile.resumeMimeType || "text/plain", name: profile.resumeName || "Confirmed resume", originalCharacters: profile.resumeText.length, size: profile.resumeSize || profile.resumeText.length, text: profile.resumeText, truncated: profile.resumeText.length > MAX_RESUME_CHARS }); setResumeText(profile.resumeText); setMessage("Review and confirm any edits to replace the current resume."); setError(false); };
  const generateSummary = async () => {
    if (!state?.profile?.resumeConfirmedAt || busyRef.current) return; const owner = accountId; const id = summaryRequestIdRef.current || randomUUID(); summaryRequestIdRef.current = id;
    busyRef.current = true; setBusy(true); setMessage(""); setError(false);
    try { const response = await fetchWithAuth("/api/mobile/v1/interview/preparation/resume/summary", { body: JSON.stringify({ id, revision: state.revision }), method: "POST" }); const next = await parseApiResponse<ResumeSummaryDraft>(response); if (owner === accountRef.current && mountedRef.current) setSummaryDraft(next); }
    catch (cause) { if (owner === accountRef.current && mountedRef.current) { setMessage(cause instanceof Error ? cause.message : "Summary could not be generated. Retry uses the same draft request."); setError(true); } }
    finally { busyRef.current = false; if (owner === accountRef.current && mountedRef.current) setBusy(false); }
  };
  const acceptSummary = () => { if (!summaryDraft) return; void mutate({ action: "resume_summary_accept", draftId: summaryDraft.draftId }, "Reviewed resume summary accepted.").then((saved) => { if (saved) { setSummaryDraft(undefined); summaryRequestIdRef.current = undefined; } }); };
  const pickResume = async () => {
    if (busyRef.current) return; const owner = accountId; busyRef.current = true; setBusy(true); setMessage(""); setError(false);
    let copied: File | undefined;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"] });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      copied = asset.uri.startsWith(Paths.cache.uri.endsWith("/") ? Paths.cache.uri : `${Paths.cache.uri}/`) ? new File(asset.uri) : undefined;
      if (owner !== accountRef.current || !mountedRef.current) return;
      if (asset.size && asset.size > 2 * 1024 * 1024) throw new Error("Resume must be 2 MB or smaller. Paste text instead.");
      const form = new FormData(); form.append("resume", { name: asset.name, type: asset.mimeType || "application/octet-stream", uri: asset.uri } as unknown as Blob); const response = await fetchWithAuth("/api/mobile/v1/interview/preparation/resume/extract", { body: form, method: "POST" }); const extracted = await parseApiResponse<ExtractedResume>(response); if (accountRef.current === owner && mountedRef.current) { setResumeDraft(extracted); setResumeText(extracted.text); }
    }
    catch (cause) { if (accountRef.current === owner && mountedRef.current) { setMessage(cause instanceof Error ? cause.message : "Resume could not be read. Paste its text instead."); setError(true); } }
    finally { try { copied?.delete(); } catch { /* Only remove a verified picker cache copy. */ } busyRef.current = false; if (accountRef.current === owner && mountedRef.current) setBusy(false); }
  };
  const confirmResume = () => { if (!resumeDraft) return; const text = resumeText.trim(); if (!text) { setMessage("Resume text is required before confirming."); return; } if (text.length > MAX_RESUME_CHARS) { setMessage("Shorten the reviewed resume to 12,000 characters before confirming."); return; } void mutate({ action: "resume_confirm", mimeType: resumeDraft.mimeType, name: resumeDraft.name, size: resumeDraft.size, text }, "Resume confirmed for future practice.").then((saved) => { if (saved) { setResumeDraft(undefined); setResumeText(""); setSummaryDraft(undefined); summaryRequestIdRef.current = undefined; } }); };
  const discardResumeDraft = () => Alert.alert("Discard resume review?", "The currently confirmed resume will stay unchanged.", [{ style: "cancel", text: "Keep editing" }, { style: "destructive", text: "Discard", onPress: () => { setResumeDraft(undefined); setResumeText(""); } }]);
  const removeResume = () => Alert.alert("Remove confirmed resume?", "It will no longer inform future practice. Historical session copies remain.", [{ style: "cancel", text: "Cancel" }, { style: "destructive", text: "Remove", onPress: () => void mutate({ action: "resume_remove" }, "Resume removed from future practice.") }]);
  if (preparation.isLoading) return <LoadingState />;
  if (preparation.isError || !state) return <ErrorState message="Your preparation could not be loaded." onRetry={() => preparation.refetch()} />;
  return <Screen bottomInset={false} eyebrow="Your setup" keyboardAvoiding subtitle={user?.email || "Local development account"} title="Me">
    <Card title="Interview profile"><Field editable={!isBusy} label="Preferred name" onChangeText={setPreferredName} value={preferredName} /><Button disabled={!preferredName.trim()} icon={Save} label="Save name" loading={busy} onPress={() => void mutate({ action: "name", preferredName }, "Preferred name saved.")} /></Card>
    <Card title="Job targets"><Text style={styles.support}>Choose one target for practice, or clear it for general preparation.</Text>{state?.targets.map((target) => <View key={target.id} style={styles.target}><Text style={styles.targetTitle}>{target.label}</Text><Text style={styles.support}>{target.jobDescription || "No job description"}</Text><Button label={state.profile?.jobTargetId === target.id ? "Active target" : "Make active"} onPress={() => void mutate({ action: "target_active", id: target.id }, "Active target updated.")} variant="secondary" /><Button label="Edit" onPress={() => beginTarget(target)} variant="secondary" /><Button icon={Trash2} label="Delete" onPress={() => removeTarget(target)} variant="danger" /></View>)}<Button label="Use general preparation" onPress={() => void mutate({ action: "target_active", id: null }, "General preparation is active.")} variant="secondary" /><Button icon={Plus} label={editingTarget !== undefined ? "Cancel editing" : "Add job target"} onPress={() => editingTarget !== undefined ? discardTarget() : beginTarget()} variant="secondary" />{editingTarget !== undefined ? <View style={styles.editor}><Field editable={!isBusy} label="Target role" onChangeText={setTargetRole} value={targetRole} /><Field editable={!isBusy} label="Company" onChangeText={setTargetCompany} value={targetCompany} /><Field editable={!isBusy} label="Job description" multiline onChangeText={setJobDescription} value={jobDescription} /><Button disabled={!targetRole.trim()} icon={Save} label={editingTarget ? "Save target" : "Create target"} loading={busy} onPress={saveTarget} /></View> : null}</Card>
    <Card title="Resume"><Text style={styles.support}>{state?.profile?.resumeConfirmedAt ? `Confirmed: ${state.profile.resumeName || "resume"}` : "No confirmed resume yet."}</Text><Button disabled={isBusy} icon={Upload} label="Choose resume file" loading={busy} onPress={() => void pickResume()} variant="secondary" /><Field editable={!isBusy} label="Or paste resume text" multiline onChangeText={setResumeText} value={resumeText} /><Button disabled={isBusy} label="Review pasted text" onPress={reviewPaste} variant="secondary" />{state?.profile?.resumeText && !resumeDraft ? <Button disabled={isBusy} label="Review current confirmed resume" onPress={reviewConfirmedResume} variant="secondary" /> : null}{resumeDraft ? <View style={styles.editor}><Text style={styles.targetTitle}>Review: {resumeDraft.name}</Text><Text style={styles.support}>{resumeDraft.truncated ? `Extraction found ${resumeDraft.originalCharacters} characters. Shorten this review before confirming.` : "Edit the extracted text before confirming."}</Text><Field editable={!isBusy} label="Reviewed resume text" multiline onChangeText={setResumeText} value={resumeText} /><Button disabled={resumeText.trim().length === 0 || resumeText.trim().length > MAX_RESUME_CHARS} icon={FileText} label="Confirm resume" loading={busy} onPress={confirmResume} /><Button disabled={isBusy} label="Discard review" onPress={discardResumeDraft} variant="secondary" /></View> : null}{state?.profile?.resumeConfirmedAt && !resumeDraft ? <View style={styles.editor}><Button disabled={isBusy} label="Generate reviewed resume summary" loading={busy} onPress={() => void generateSummary()} variant="secondary" />{summaryDraft ? <View style={styles.summary}><Text style={styles.targetTitle}>Proposed resume summary</Text>{Object.entries(summaryDraft.summary).map(([key, value]) => <Text key={key} style={styles.support}>{key.replace(/([A-Z])/g, " $1")}: {Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value)}</Text>)}<Button disabled={isBusy} label="Accept summary" onPress={acceptSummary} /><Button disabled={isBusy} label="Discard summary" onPress={() => { setSummaryDraft(undefined); summaryRequestIdRef.current = undefined; }} variant="secondary" /></View> : null}</View> : null}{state?.profile?.resumeConfirmedAt ? <Button disabled={isBusy} icon={Trash2} label="Remove confirmed resume" onPress={removeResume} variant="danger" /> : null}</Card>
    {message ? <Text accessibilityRole="alert" style={[styles.message, error || stale ? styles.error : styles.success]}>{message}</Text> : null}{stale ? <Button disabled={isBusy} label="Reload saved preparation" onPress={() => void reload()} variant="secondary" /> : null}<Button disabled={isBusy} icon={LogOut} label="Sign out" onPress={async () => { await signOut(); queryClient.clear(); router.replace("/sign-in"); }} variant="danger" />
  </Screen>;
}
function Field({ editable = true, label, multiline, onChangeText, value }: { editable?: boolean; label: string; multiline?: boolean; onChangeText: (text: string) => void; value: string }) { return <><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={editable} multiline={multiline} onChangeText={onChangeText} placeholderTextColor={colors.muted} style={[styles.input, multiline && styles.multiline, !editable && styles.readonly]} value={value} /></>; }
const styles = StyleSheet.create({ editor: { borderColor: colors.border, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm }, error: { color: colors.danger }, input: { backgroundColor: colors.backgroundRaised, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, label: { color: colors.textSoft, fontSize: 13, fontWeight: "700", marginTop: spacing.xs }, message: { fontSize: 14, lineHeight: 20 }, multiline: { minHeight: 120, textAlignVertical: "top" }, readonly: { opacity: 0.7 }, success: { color: colors.lime }, summary: { gap: spacing.xs }, support: { color: colors.muted, fontSize: 14, lineHeight: 21 }, target: { borderColor: colors.border, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.sm }, targetTitle: { color: colors.text, fontSize: 15, fontWeight: "800" } });
