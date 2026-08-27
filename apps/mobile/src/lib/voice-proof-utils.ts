const proofWords = [
  "amber", "beacon", "cedar", "comet", "harbor", "maple", "orbit", "river",
  "runway", "silver", "summit", "tango", "violet", "willow", "winter", "zephyr",
];

export function createVerificationPhrase(sessionId: string) {
  const hex = sessionId.replace(/[^a-fA-F0-9]/g, "").padEnd(6, "0");
  return [0, 2, 4]
    .map((offset) => proofWords[Number.parseInt(hex.slice(offset, offset + 2), 16) % proofWords.length])
    .join(" ");
}

export function claimFinalization(lock: { current: boolean }) {
  if (lock.current) return false;
  lock.current = true;
  return true;
}
