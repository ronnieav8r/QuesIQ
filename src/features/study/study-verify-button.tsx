"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudyVerifyButtonProps = {
  deckId: string;
};

type VerifyResponse = {
  cardsReviewed?: number;
  error?: string;
  summary?: string;
  verifiedCount?: number;
};

export function StudyVerifyButton({ deckId }: StudyVerifyButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function verifyDeck() {
    if (pending) {
      return;
    }

    setPending(true);
    setMessage(undefined);

    const response = await fetch(`/api/study/decks/${deckId}/verify`, {
      method: "POST",
    });
    const payload = (await response.json().catch(() => ({}))) as VerifyResponse;

    if (!response.ok) {
      setMessage(payload.error ?? "Verification failed.");
      setPending(false);
      return;
    }

    setMessage(`${payload.verifiedCount ?? 0}/${payload.cardsReviewed ?? 0} cards verified.`);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="inline-actions">
      <button disabled={pending} onClick={() => void verifyDeck()} type="button">
        {pending ? "Verifying..." : "Run AI Verification"}
      </button>
      {message && <span>{message}</span>}
    </div>
  );
}
