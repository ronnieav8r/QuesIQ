"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StudyStackFormValues = {
  description: string;
  isPublic: boolean;
  subject: string;
  title: string;
};

export function StudyStackForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<StudyStackFormValues>({
    description: "",
    isPublic: false,
    subject: "",
    title: "",
  });

  function set(field: keyof StudyStackFormValues, value: boolean | string) {
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

    const response = await fetch("/api/study/stacks", {
      body: JSON.stringify({
        description: values.description.trim() || null,
        isPublic: values.isPublic,
        subject: values.subject.trim() || null,
        title: values.title.trim(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { stack?: { id: string }; error?: string };

    setSaving(false);

    if (!response.ok || !data.stack) {
      setError(data.error ?? "Stack could not be saved.");
      return;
    }

    router.push(`/study/stacks/${data.stack.id}`);
    router.refresh();
  }

  return (
    <form className="study-deck-form" onSubmit={handleSubmit}>
      <label>
        <span>Title *</span>
        <input
          autoFocus
          onChange={(event) => set("title", event.target.value)}
          placeholder="Private Pilot Checkride Path"
          type="text"
          value={values.title}
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          onChange={(event) => set("description", event.target.value)}
          placeholder="What sequence should a learner follow?"
          rows={3}
          value={values.description}
        />
      </label>
      <label>
        <span>Subject</span>
        <input
          onChange={(event) => set("subject", event.target.value)}
          placeholder="Aviation, Biology, Law"
          type="text"
          value={values.subject}
        />
      </label>
      <label className="study-check-label">
        <input
          checked={values.isPublic}
          onChange={(event) => set("isPublic", event.target.checked)}
          type="checkbox"
        />
        <span>Make this stack Public so others can follow the deck sequence.</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="inline-actions">
        <button className="secondary" onClick={() => router.back()} type="button">
          Cancel
        </button>
        <button disabled={saving} type="submit">
          {saving ? "Saving" : "Create Stack"}
        </button>
      </div>
    </form>
  );
}
