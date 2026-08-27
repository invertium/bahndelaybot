import { describe, expect, it, vi } from "vitest";
import { completePendingInvitation } from "./invitations";

type CompletionDb = NonNullable<Parameters<typeof completePendingInvitation>[1]>;

describe("invitation completion", () => {
  it("accepts a newly claimed invitation", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ completed: true }] });
    const result = await completePendingInvitation(
      { token: "a".repeat(43), userId: "user-1", email: " Person@Example.DE " },
      { execute } as unknown as CompletionDb,
    );

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("is idempotent when the database reports an already completed membership", async () => {
    const execute = vi.fn().mockResolvedValue([{ completed: "true" }]);
    await expect(completePendingInvitation(
      { token: "b".repeat(43), userId: "user-2", email: "person@example.de" },
      { execute } as unknown as CompletionDb,
    )).resolves.toEqual({ ok: true });
  });

  it("rejects missing, mismatched, or expired invitations", async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ completed: false }] });
    await expect(completePendingInvitation(
      { token: "c".repeat(43), userId: "user-3", email: "person@example.de" },
      { execute } as unknown as CompletionDb,
    )).resolves.toEqual({ ok: false, reason: "invalid" });
  });
});
