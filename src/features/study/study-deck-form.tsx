"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StudyDeckFormValues = {
  description: string;
  examDate: string;
  examName: string;
  folderId: string;
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
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [values, setValues] = useState<StudyDeckFormValues>({
    description: initialValues?.description ?? "",
    examDate: initialValues?.examDate ?? "",
    examName: initialValues?.examName ?? "",
    folderId: initialValues?.folderId ?? "",
    isPublic: initialValues?.isPublic ?? false,
    subject: initialValues?.subject ?? "",
    tags: initialValues?.tags ?? "",
    title: initialValues?.title ?? "",
  });

  useEffect(() => {
    void fetch("/api/study/folders")
      .then((response) => response.json())
      .then((data: { folders?: Array<{ id: string; name: string }> }) => {
        if (Array.isArray(data.folders)) {
          setFolders(data.folders);
        }
      })
      .catch(() => undefined);
  }, []);

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
        folderId: values.folderId || null,
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

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name || creatingFolder) {
      return;
    }
    setCreatingFolder(true);
    const response = await fetch("/api/study/folders", {
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { folder?: { id: string; name: string }; error?: string };
    setCreatingFolder(false);
    if (!response.ok || !data.folder) {
      setError(data.error ?? "Folder could not be created.");
      return;
    }
    setFolders((current) => [...current, data.folder!].sort((a, b) => a.name.localeCompare(b.name)));
    set("folderId", data.folder.id);
    setNewFolderName("");
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
        <span>Folder</span>
        <select
          onChange={(event) => set("folderId", event.target.value)}
          value={values.folderId}
        >
          <option value="">No folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <div className="inline-actions">
        <input
          onChange={(event) => setNewFolderName(event.target.value)}
          placeholder="New folder name"
          type="text"
          value={newFolderName}
        />
        <button className="secondary" disabled={creatingFolder || !newFolderName.trim()} onClick={() => void createFolder()} type="button">
          {creatingFolder ? "Adding..." : "Add Folder"}
        </button>
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
