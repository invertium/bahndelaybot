import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  getDb: vi.fn(),
  sendInvitationEmail: vi.fn(),
}));

vi.mock("@/lib/membership", () => ({ getMemberSession: mocks.member }));
vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/email", () => ({ sendInvitationEmail: mocks.sendInvitationEmail }));
vi.mock("@/lib/env", () => ({ getAppUrl: () => "https://bahn.test" }));

import { POST } from "./route";

const admin = { session: { user: { id: "admin-1" } }, role: "admin" };

function selection(result: unknown[]) {
  const limit = vi.fn().mockResolvedValue(result);
  const where = vi.fn(() => ({ limit }));
  return {
    from: vi.fn(() => ({
      where,
      innerJoin: vi.fn(() => ({ where })),
    })),
  };
}

function request(body: unknown) {
  return new Request("https://bahn.test/api/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/invitations", () => {
  beforeEach(() => {
    mocks.member.mockReset();
    mocks.getDb.mockReset();
    mocks.sendInvitationEmail.mockReset();
  });

  it("requires an administrator", async () => {
    mocks.member.mockResolvedValue(null);
    const response = await POST(request({ email: "person@example.de" }));

    expect(response.status).toBe(403);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("creates and emails a normalized invitation", async () => {
    const invitationId = "11111111-1111-4111-8111-111111111111";
    const expiresAt = new Date("2026-09-03T12:00:00.000Z");
    const insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: invitationId, expiresAt }]),
      })),
    }));
    const db = {
      select: vi.fn()
        .mockReturnValueOnce(selection([]))
        .mockReturnValueOnce(selection([])),
      insert,
      delete: vi.fn(),
    };
    mocks.member.mockResolvedValue(admin);
    mocks.getDb.mockReturnValue(db);
    mocks.sendInvitationEmail.mockResolvedValue({ id: "email-1" });

    const response = await POST(request({ email: " Person@Example.DE " }));

    expect(response.status).toBe(201);
    expect(mocks.sendInvitationEmail).toHaveBeenCalledWith(
      "person@example.de",
      expect.stringMatching(/^https:\/\/bahn\.test\/invite\/[A-Za-z0-9_-]{43}$/),
      invitationId,
    );
  });

  it("rotates an open invitation token when an admin resends", async () => {
    const invitationId = "22222222-2222-4222-8222-222222222222";
    const updateWhere = vi.fn().mockResolvedValue([]);
    const db = {
      select: vi.fn().mockReturnValue(selection([{
        id: invitationId,
        email: "person@example.de",
        tokenHash: "old-hash",
        expiresAt: new Date("2026-09-01T12:00:00.000Z"),
      }])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: updateWhere })) })),
    };
    mocks.member.mockResolvedValue(admin);
    mocks.getDb.mockReturnValue(db);
    mocks.sendInvitationEmail.mockResolvedValue({ id: "email-2" });

    const response = await POST(request({ invitationId }));

    expect(response.status).toBe(200);
    expect(db.update).toHaveBeenCalledOnce();
    expect(mocks.sendInvitationEmail).toHaveBeenCalledWith(
      "person@example.de",
      expect.stringMatching(/^https:\/\/bahn\.test\/invite\/[A-Za-z0-9_-]{43}$/),
      invitationId,
      expect.stringMatching(new RegExp(`^invitation-${invitationId}-`)),
    );
  });

  it("rolls token rotation back when resend delivery fails", async () => {
    const invitationId = "33333333-3333-4333-8333-333333333333";
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) }));
    const db = {
      select: vi.fn().mockReturnValue(selection([{
        id: invitationId,
        email: "person@example.de",
        tokenHash: "old-hash",
        expiresAt: new Date("2026-09-01T12:00:00.000Z"),
      }])),
      update: vi.fn(() => ({ set })),
    };
    mocks.member.mockResolvedValue(admin);
    mocks.getDb.mockReturnValue(db);
    mocks.sendInvitationEmail.mockRejectedValue(new Error("provider unavailable"));

    const response = await POST(request({ invitationId }));

    expect(response.status).toBe(502);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({
      tokenHash: "old-hash",
      expiresAt: new Date("2026-09-01T12:00:00.000Z"),
    }));
  });
});
