import { describe, expect, it } from "vitest";
import { createInvitationToken, hashToken, isInvitationToken, maskEmail, normalizeEmail } from "./security";

describe("invitation security", () => {
  it("creates high-entropy base64url tokens with deterministic hashes", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();

    expect(first).toHaveLength(43);
    expect(isInvitationToken(first)).toBe(true);
    expect(second).not.toBe(first);
    expect(hashToken(first)).toHaveLength(64);
    expect(hashToken(first)).toBe(hashToken(first));
  });

  it("rejects malformed tokens and normalizes email safely", () => {
    expect(isInvitationToken("too-short")).toBe(false);
    expect(isInvitationToken(`${"a".repeat(42)}!`)).toBe(false);
    expect(normalizeEmail("  Person@Example.DE ")).toBe("person@example.de");
    expect(maskEmail("person@example.de")).toMatch(/^pe.+@example\.de$/);
    expect(maskEmail("person@example.de")).not.toContain("person@");
  });
});
