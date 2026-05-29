"use client";

import { Check, ChevronDown, ChevronRight, Folder, FolderPlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { StudyDeckCard } from "@/features/study/study-deck-card";

type StudyFolder = {
  id: string;
  name: string;
};

type StudyFolderDeck = {
  cardCount: number;
  description: string | null;
  dueCount?: number;
  folderId?: string | null;
  id: string;
  isOfficial: boolean;
  isPublic: boolean;
  lastStudiedAt?: Date | null;
  masteredCount?: number;
  subject: string | null;
  title: string;
  userId: string | null;
  verifiedCardCount?: number;
};

type StudyFolderManagerProps = {
  currentUserId: string;
  decks: StudyFolderDeck[];
  initialFolders: StudyFolder[];
};

export function StudyFolderManager({ currentUserId, decks, initialFolders }: StudyFolderManagerProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [movingDeck, setMovingDeck] = useState<StudyFolderDeck | null>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const [deckFolderMap, setDeckFolderMap] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(decks.map((deck) => [deck.id, deck.folderId ?? null])),
  );

  const grouped = useMemo(() => {
    const byFolder = new Map<string, StudyFolderDeck[]>();
    const uncategorized: StudyFolderDeck[] = [];
    const folderIds = new Set(folders.map((folder) => folder.id));

    for (const deck of decks) {
      const folderId = deckFolderMap[deck.id];
      if (folderId && folderIds.has(folderId)) {
        byFolder.set(folderId, [...(byFolder.get(folderId) ?? []), deck]);
      } else {
        uncategorized.push(deck);
      }
    }

    return { byFolder, uncategorized };
  }, [deckFolderMap, decks, folders]);

  async function createFolder() {
    const name = newName.trim();
    if (!name || busy) return;

    setBusy(true);
    const response = await fetch("/api/study/folders", {
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { folder?: StudyFolder; error?: string };
    setBusy(false);

    if (response.ok && data.folder) {
      setFolders((current) => [...current, data.folder!].sort((a, b) => a.name.localeCompare(b.name)));
      setCreating(false);
      setNewName("");
    }
  }

  async function renameFolder(folderId: string) {
    const name = renameValue.trim();
    if (!name) return;

    const response = await fetch(`/api/study/folders/${folderId}`, {
      body: JSON.stringify({ name }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    const data = (await response.json()) as { folder?: StudyFolder };

    if (response.ok && data.folder) {
      setFolders((current) =>
        current
          .map((folder) => (folder.id === folderId ? data.folder! : folder))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setRenamingId(null);
      setRenameValue("");
    }
  }

  async function deleteFolder(folderId: string) {
    if (!window.confirm("Delete this folder? Decks in it will move to Uncategorized.")) return;

    const response = await fetch(`/api/study/folders/${folderId}`, { method: "DELETE" });
    if (response.ok) {
      setFolders((current) => current.filter((folder) => folder.id !== folderId));
      setDeckFolderMap((current) =>
        Object.fromEntries(Object.entries(current).map(([deckId, value]) => [deckId, value === folderId ? null : value])),
      );
    }
  }

  async function moveDeck(deckId: string, folderId: string | null) {
    const response = await fetch(`/api/study/decks/${deckId}`, {
      body: JSON.stringify({ folderId }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    if (response.ok) {
      setDeckFolderMap((current) => ({ ...current, [deckId]: folderId }));
      setMovingDeck(null);
    }
  }

  function toggleFolder(folderId: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function startCreate() {
    setCreating(true);
    setNewName("");
    window.setTimeout(() => newFolderRef.current?.focus(), 0);
  }

  function renderDeckGrid(items: StudyFolderDeck[]) {
    return (
      <div className="study-deck-grid">
        {items.map((deck) => (
          <div className="study-folder-deck" key={deck.id}>
            <StudyDeckCard currentUserId={currentUserId} deck={deck} />
            <button
              aria-label={`Move ${deck.title} to a folder`}
              className="study-folder-deck__move"
              onClick={() => setMovingDeck(deck)}
              title="Move to folder"
              type="button"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="study-folder-manager">
      {folders.map((folder) => {
        const isOpen = !collapsed.has(folder.id);
        const isRenaming = renamingId === folder.id;
        const items = grouped.byFolder.get(folder.id) ?? [];

        return (
          <section className="study-folder-section" key={folder.id}>
            <div className="study-folder-section__header">
              <button
                aria-expanded={isOpen}
                className="study-folder-section__toggle"
                onClick={() => !isRenaming && toggleFolder(folder.id)}
                type="button"
              >
                {isOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                <Folder size={16} aria-hidden="true" />
                {isRenaming ? (
                  <input
                    aria-label="Folder name"
                    autoFocus
                    onChange={(event) => setRenameValue(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void renameFolder(folder.id);
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                    value={renameValue}
                  />
                ) : (
                  <span>
                    {folder.name} <small>{items.length}</small>
                  </span>
                )}
              </button>

              <div className="inline-actions">
                {isRenaming ? (
                  <>
                    <button className="secondary" onClick={() => void renameFolder(folder.id)} type="button">Save</button>
                    <button className="secondary" onClick={() => setRenamingId(null)} type="button">Cancel</button>
                  </>
                ) : (
                  <>
                    <button
                      aria-label={`Rename ${folder.name}`}
                      className="secondary icon-button"
                      onClick={() => {
                        setRenamingId(folder.id);
                        setRenameValue(folder.name);
                      }}
                      title="Rename folder"
                      type="button"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`Delete ${folder.name}`}
                      className="secondary danger icon-button"
                      onClick={() => void deleteFolder(folder.id)}
                      title="Delete folder"
                      type="button"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (items.length > 0 ? renderDeckGrid(items) : <p className="text-muted">No decks in this folder yet.</p>)}
          </section>
        );
      })}

      {grouped.uncategorized.length > 0 && (
        <section className="study-folder-section">
          {folders.length > 0 && (
            <div className="study-folder-section__plain-heading">
              Uncategorized <small>{grouped.uncategorized.length}</small>
            </div>
          )}
          {renderDeckGrid(grouped.uncategorized)}
        </section>
      )}

      {creating ? (
        <div className="study-folder-create">
          <input
            aria-label="New folder name"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createFolder();
              if (event.key === "Escape") setCreating(false);
            }}
            placeholder="Folder name"
            ref={newFolderRef}
            value={newName}
          />
          <button disabled={busy || !newName.trim()} onClick={() => void createFolder()} type="button">Create</button>
          <button className="secondary" onClick={() => setCreating(false)} type="button">Cancel</button>
        </div>
      ) : (
        <button className="secondary study-folder-create__trigger" onClick={startCreate} type="button">
          <FolderPlus size={14} aria-hidden="true" />
          New Folder
        </button>
      )}

      {movingDeck && (
        <div className="study-folder-sheet" role="dialog" aria-label="Move deck to folder">
          <div className="study-folder-sheet__panel">
            <div>
              <p className="eyebrow">Move to folder</p>
              <h2>{movingDeck.title}</h2>
            </div>
            <button
              className={deckFolderMap[movingDeck.id] === null ? "" : "secondary"}
              onClick={() => void moveDeck(movingDeck.id, null)}
              type="button"
            >
              No folder {deckFolderMap[movingDeck.id] === null && <Check size={14} aria-hidden="true" />}
            </button>
            {folders.map((folder) => (
              <button
                className={deckFolderMap[movingDeck.id] === folder.id ? "" : "secondary"}
                key={folder.id}
                onClick={() => void moveDeck(movingDeck.id, folder.id)}
                type="button"
              >
                <Folder size={14} aria-hidden="true" />
                {folder.name}
                {deckFolderMap[movingDeck.id] === folder.id && <Check size={14} aria-hidden="true" />}
              </button>
            ))}
            <button className="secondary" onClick={() => setMovingDeck(null)} type="button">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
