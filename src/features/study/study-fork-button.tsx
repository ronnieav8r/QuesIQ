"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudyForkButtonProps = {
  deckId: string;
};

export function StudyForkButton({ deckId }: StudyForkButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFork() {
    if (pending) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/study/decks/${deckId}/fork`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        deck?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.deck?.id) {
        setError(data.error ?? "Unable to copy deck.");
        setPending(false);
        return;
      }

      router.push(`/study/decks/${data.deck.id}`);
      router.refresh();
    } catch {
      setError("Unable to copy deck.");
      setPending(false);
    }
  }

  return (
    <div className="study-fork-action">
      <button className="secondary" disabled={pending} onClick={onFork} type="button">
        {pending ? "Saving Copy..." : "Save Copy"}
      </button>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
