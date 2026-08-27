import { claimFinalization, createVerificationPhrase } from "@/lib/voice-proof-utils";
import { describe, expect, it } from "@jest/globals";

describe("native voice proof utilities", () => {
  it("creates a stable three-word phrase from a session id", () => {
    const first = createVerificationPhrase("12345678-1234-1234-1234-123456789abc");
    expect(first.split(" ")).toHaveLength(3);
    expect(createVerificationPhrase("12345678-1234-1234-1234-123456789abc")).toBe(first);
  });

  it("allows only one finalization claim", () => {
    const lock = { current: false };
    expect(claimFinalization(lock)).toBe(true);
    expect(claimFinalization(lock)).toBe(false);
  });
});
