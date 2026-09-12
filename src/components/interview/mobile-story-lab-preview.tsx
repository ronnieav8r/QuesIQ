"use client";
import { storyCategories } from "@quesiq/interview-contracts";
import styles from "./mobile-preview-lab.module.css";
export type PreviewMaterial = { title: string; notes: string; text: string; category: string; kind: "story" | "introduction" };
export type PreviewLabState = { draft?: PreviewMaterial; saved?: PreviewMaterial; error?: string };
export function MobileStoryLabPreview({ state, onChange }: { state: PreviewLabState; onChange: (state: PreviewLabState) => void }) {
  const draft = state.draft;
  return <div className={styles.mobilePage}><header className={styles.mobileHeader}><p className={styles.mobileEyebrow}>Practice material · sample</p><h2>Story Lab</h2><p>Original facts first. Optional drafts require your review.</p></header><p className={styles.sampleNotice}>Preview only · no AI calls or saved learner records</p>
    {!draft ? <section className={styles.mobileCard}><h3>Your library</h3>{state.saved ? <><strong>{state.saved.title}</strong><p>{state.saved.kind === "story" ? "Story" : "Introduction"} · reviewed sample</p><button type="button" className={styles.mobilePrimary} onClick={() => onChange({ ...state, draft: { ...state.saved! } })}>Edit saved material</button></> : <p>No material yet.</p>}<button type="button" className={styles.mobilePrimary} onClick={() => onChange({ ...state, draft: { title: "", notes: "", text: "", category: "teamwork", kind: "story" } })}>Add story</button><button type="button" className={styles.mobilePrimary} onClick={() => onChange({ ...state, draft: { title: "", notes: "", text: "", category: "", kind: "introduction" } })}>Add introduction</button></section> : <section className={styles.mobileCard}>
      <strong>{draft.kind === "story" ? "Story editor" : "Introduction editor"}</strong>
      <label>Title<input aria-label="Material title" value={draft.title} onChange={event => onChange({ ...state, draft: { ...draft, title: event.target.value } })} /></label>
      <label>Original notes<textarea aria-label="Material original notes" value={draft.notes} onChange={event => onChange({ ...state, draft: { ...draft, notes: event.target.value } })} /></label>
      <label>{draft.kind === "story" ? "Situation / Task / Actions / Result (optional)" : "Introduction text"}<textarea aria-label="Material text" value={draft.text} onChange={event => onChange({ ...state, draft: { ...draft, text: event.target.value } })} /></label>
      {draft.kind === "story" ? <label>Category<select aria-label="Material category" value={draft.category} onChange={event => onChange({ ...state, draft: { ...draft, category: event.target.value } })}>{storyCategories.map(category => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}</select></label> : <p>Virtual interview · Medium length</p>}
      <p>Categories organize coverage, not competency. Save incomplete notes now and develop them later.</p>
      <button type="button" className={styles.mobilePrimary} disabled={!draft.title.trim()} onClick={() => onChange({ saved: draft })}>Save reviewed material (preview)</button>
      <button type="button" className={styles.textAction} onClick={() => onChange({ ...state, draft: undefined })}>Discard preview edits</button>
    </section>}
  </div>;
}
