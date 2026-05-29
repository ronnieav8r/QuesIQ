"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StudyDeckFormValues = {
  description: string;
  examDate: string;
  examName: string;
  isPublic: boolean;
  subject: string;
  tags: string;
  title: string;
};

type StudyDeckFormProps = {
  deckId?: string;
  initialValues?: Partial<StudyDeckFormValues>;
};

export function StudyDeckForm({ deckId, initialValues }: StudyDeckFormProps) {
  const router = useRouter();
  const isEdit = Boolean(deckId);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<StudyDeckFormValues>({
    description: initialValues?.description ?? "",
    examDate: initialValues?.examDate ?? "",
    examName: initialValues?.examName ?? "",
    isPublic: initialValues?.isPublic ?? false,
    subject: initialValues?.subject ?? "",
    tags: initialValues?.tags ?? "",
    title: initialValues?.title ?? "",
  });

  function set(field: keyof StudyDeckFormValues, value: boolean | string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!values.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(undefined);

    const tags = values.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const response = await fetch(isEdit ? `/api/study/decks/${deckId}` : "/api/study/decks", {
      body: JSON.stringify({
        description: values.description.trim() || undefined,
        examDate: values.examDate || null,
        examName: values.examName.trim() || null,
        isPublic: values.isPublic,
        subject: values.subject.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        title: values.title.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: isEdit ? "PATCH" : "POST",
    });
    const data = (await response.json()) as { deck?: { id: string }; error?: string };

    setSaving(false);

    if (!response.ok || !data.deck) {
      setError(data.error ?? "Deck could not be saved.");
      return;
    }

    router.push(`/study/decks/${data.deck.id}`);
    router.refresh();
  }

  return (
    <form className="study-deck-form" onSubmit={handleSubmit}>
      <label>
        <span>Title *</span>
        <input
          autoFocus
          onChange={(event) => set("title", event.target.value)}
          placeholder="Aviation Regulations, Biology, Nursing Pharmacology"
          type="text"
          value={values.title}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          onChange={(event) => set("description", event.target.value)}
          placeholder="What does this deck cover?"
          rows={3}
          value={values.description}
        />
      </label>
      <div className="field-grid">
        <label>
          <span>Exam / Goal</span>
          <input
            onChange={(event) => set("examName", event.target.value)}
            placeholder="FAA Written, NCLEX, Bar Exam"
            type="text"
            value={values.examName}
          />
        </label>
        <label>
          <span>Exam Date</span>
          <input
            onChange={(event) => set("examDate", event.target.value)}
            type="date"
            value={values.examDate}
          />
        </label>
      </div>
      <label>
        <span>Subject</span>
        <input
          onChange={(event) => set("subject", event.target.value)}
          placeholder="Aviation, Biology, Law"
          type="text"
          value={values.subject}
        />
      </label>
      <label>
        <span>Tags</span>
        <input
          onChange={(event) => set("tags", event.target.value)}
          placeholder="comma, separated, tags"
          type="text"
          value={values.tags}
        />
      </label>
      <label className="study-check-label">
        <input
          checked={values.isPublic}
          onChange={(event) => set("isPublic", event.target.checked)}
          type="checkbox"
        />
        <span>Make this deck public</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="inline-actions">
        <button className="secondary" onClick={() => router.back()} type="button">
          Cancel
        </button>
        <button disabled={saving} type="submit">
          {saving ? "Saving" : isEdit ? "Save Changes" : "Create Deck"}
        </button>
      </div>
    </form>
  );
}
