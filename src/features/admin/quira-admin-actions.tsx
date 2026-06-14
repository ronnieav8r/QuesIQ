"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type QuiraAdminCase = {
  id: string;
  knownIssueId?: string | null;
  severity: string;
  status: string;
  title: string;
};

type QuiraAdminKnownIssue = {
  id: string;
  status: string;
  title: string;
};

type Props = {
  cases: QuiraAdminCase[];
  knownIssues: QuiraAdminKnownIssue[];
};

async function postQuiraAdminAction(action: string, payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/support", {
    body: JSON.stringify({ action, payload }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = (await response.json().catch(() => ({}))) as {
    detail?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.detail || body.error || "Quira admin action failed.");
  }
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export function QuiraAdminActions({ cases, knownIssues }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    action: string,
    payloadBuilder: (formData: FormData) => Record<string, unknown>,
  ) {
    event.preventDefault();
    setError(undefined);
    setPending(true);

    try {
      await postQuiraAdminAction(action, payloadBuilder(new FormData(event.currentTarget)));
      event.currentTarget.reset();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Quira admin action failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Admin Controls</p>
          <h3>Curate knowledge and triage cases</h3>
        </div>
      </div>

      <div className="quira-admin-grid">
        <form
          className="quira-admin-form"
          onSubmit={(event) =>
            void handleSubmit(event, "save_knowledge_article", (formData) => ({
              audience: formValue(formData, "audience"),
              category: formValue(formData, "category"),
              content: formValue(formData, "content"),
              product: formValue(formData, "product"),
              published: formData.get("published") === "on",
              reviewStatus: formData.get("published") === "on" ? "reviewed" : "draft",
              tags: formValue(formData, "tags"),
              title: formValue(formData, "title"),
            }))
          }
        >
          <h4>New support article</h4>
          <input name="title" placeholder="Title" required />
          <select name="product" defaultValue="shared">
            <option value="shared">Shared</option>
            <option value="study">Study</option>
            <option value="interview">Interview</option>
            <option value="dpe">DPE</option>
          </select>
          <input name="category" placeholder="Category" defaultValue="general" />
          <select name="audience" defaultValue="public">
            <option value="public">Public</option>
            <option value="signed_in">Signed in</option>
          </select>
          <textarea name="content" placeholder="Approved support answer" required rows={5} />
          <input name="tags" placeholder="tags, comma separated" />
          <label className="checkbox-row">
            <input name="published" type="checkbox" />
            <span>Publish as reviewed</span>
          </label>
          <button disabled={pending} type="submit">
            Save Article
          </button>
        </form>

        <form
          className="quira-admin-form"
          onSubmit={(event) =>
            void handleSubmit(event, "save_known_issue", (formData) => ({
              adminNotes: formValue(formData, "adminNotes"),
              affectedScreens: formValue(formData, "affectedScreens"),
              product: formValue(formData, "product"),
              severity: formValue(formData, "severity"),
              status: formValue(formData, "status"),
              summary: formValue(formData, "summary"),
              title: formValue(formData, "title"),
              workaround: formValue(formData, "workaround"),
            }))
          }
        >
          <h4>New known issue</h4>
          <input name="title" placeholder="Issue title" required />
          <select name="product" defaultValue="shared">
            <option value="shared">Shared</option>
            <option value="study">Study</option>
            <option value="interview">Interview</option>
            <option value="dpe">DPE</option>
          </select>
          <select name="status" defaultValue="open">
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="fixed">Fixed and hide</option>
          </select>
          <select name="severity" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <textarea name="summary" placeholder="Current user-facing issue summary" required rows={4} />
          <textarea name="workaround" placeholder="Current workaround, if any" rows={3} />
          <input name="affectedScreens" placeholder="/study/decks, voice, import" />
          <textarea name="adminNotes" placeholder="Internal notes" rows={3} />
          <button disabled={pending} type="submit">
            Save Issue
          </button>
        </form>
      </div>

      {cases.length > 0 && (
        <div className="quira-triage-list">
          {cases.map((supportCase) => (
            <form
              className="quira-triage-row"
              key={supportCase.id}
              onSubmit={(event) =>
                void handleSubmit(event, "update_case_triage", (formData) => ({
                  caseId: supportCase.id,
                  knownIssueId: formValue(formData, "knownIssueId"),
                  note: formValue(formData, "note"),
                  severity: formValue(formData, "severity"),
                  status: formValue(formData, "status"),
                  tags: formValue(formData, "tags"),
                }))
              }
            >
              <strong>{supportCase.title}</strong>
              <select name="status" defaultValue={supportCase.status}>
                <option value="new">New</option>
                <option value="triage">Triage</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select name="severity" defaultValue={supportCase.severity}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select name="knownIssueId" defaultValue={supportCase.knownIssueId ?? ""}>
                <option value="">No linked issue</option>
                {knownIssues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.title} ({issue.status})
                  </option>
                ))}
              </select>
              <input name="tags" placeholder="tags" />
              <input name="note" placeholder="admin note" />
              <button disabled={pending} type="submit">
                Update
              </button>
            </form>
          ))}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
