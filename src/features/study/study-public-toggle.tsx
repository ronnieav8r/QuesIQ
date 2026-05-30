"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StudyPublicToggleProps = {
  deckId: string;
  disabled?: boolean;
  isPublic: boolean;
};

export function StudyPublicToggle({ deckId, disabled, isPublic }: StudyPublicToggleProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(isPublic);

  async function onToggle(next: boolean) {
    if (pending || disabled) {
      return;
    }
    setPending(true);
    setValue(next);
    const response = await fetch(`/api/study/decks/${deckId}`, {
      body: JSON.stringify({ isPublic: next }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    if (!response.ok) {
      setValue((current) => !current);
    }
    setPending(false);
    router.refresh();
  }

  return (
    <label className="study-check-label">
      <input
        checked={value}
        disabled={pending || disabled}
        onChange={(event) => void onToggle(event.target.checked)}
        type="checkbox"
      />
      <span>{pending ? "Updating..." : value ? "Public deck" : "Mine only"}</span>
    </label>
  );
}
