import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  signInMagicLink: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/auth", () => ({ auth: { api: { signInMagicLink: mocks.signInMagicLink } } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.cookieSet }) }));

import { POST } from "./route";

function databaseWith(invite?: { email: string }) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(invite ? [invite] : []),
        })),
      })),
    })),
  };
}

function request(token: unknown) {
  return new Request("https://bahn.test/api/invitations/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/invitations/accept", () => {
  beforeEach(() => {
    mocks.getDb.mockReset();
    mocks.signInMagicLink.mockReset();
    mocks.cookieSet.mockReset();
  });

  it("rejects malformed tokens before querying the database", async () => {
    const response = await POST(request("not-a-token"));

    expect(response.status).toBe(400);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("returns gone for an expired, redeemed, or unknown invitation", async () => {
    mocks.getDb.mockReturnValue(databaseWith());
    const response = await POST(request("a".repeat(43)));

    expect(response.status).toBe(410);
    expect(mocks.signInMagicLink).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("sends a magic link and only then stores the short-lived pending token", async () => {
    mocks.getDb.mockReturnValue(databaseWith({ email: "Person@Example.DE" }));
    mocks.signInMagicLink.mockResolvedValue({ status: true });
    const response = await POST(request("a".repeat(43)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "person@example.de",
        callbackURL: "/invite/complete",
        metadata: { inviteToken: "a".repeat(43) },
      }),
    }));
    expect(mocks.cookieSet).toHaveBeenCalledWith("pending_invite", "a".repeat(43), expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
    }));
  });

  it("does not leave a pending cookie when email delivery fails", async () => {
    mocks.getDb.mockReturnValue(databaseWith({ email: "person@example.de" }));
    mocks.signInMagicLink.mockRejectedValue(new Error("provider unavailable"));
    const response = await POST(request("a".repeat(43)));

    expect(response.status).toBe(502);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
