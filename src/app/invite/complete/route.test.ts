import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/lib/env", () => ({ getAppUrl: () => "https://bahn.test" }));
vi.mock("@/lib/invitations", () => ({ completePendingInvitation: mocks.complete }));

import { GET } from "./route";

function request(cookie?: string) {
  return new NextRequest("https://bahn.test/invite/complete", {
    headers: cookie ? { cookie: `pending_invite=${cookie}` } : undefined,
  });
}

describe("GET /invite/complete", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.complete.mockReset();
  });

  it("redirects signed-out visitors without deleting their pending token", async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await GET(request("a".repeat(43)));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://bahn.test/?anmeldung=erforderlich");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("completes membership, clears the cookie, and redirects to the dashboard", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1", email: "person@example.de" } });
    mocks.complete.mockResolvedValue({ ok: true });
    const response = await GET(request("a".repeat(43)));

    expect(mocks.complete).toHaveBeenCalledWith({
      token: "a".repeat(43),
      userId: "user-1",
      email: "person@example.de",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://bahn.test/dashboard?willkommen=1");
    expect(response.headers.get("set-cookie")).toMatch(/pending_invite=;/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("clears an invalid pending token and shows a recoverable error page", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1", email: "person@example.de" } });
    mocks.complete.mockResolvedValue({ ok: false, reason: "invalid" });
    const response = await GET(request("b".repeat(43)));

    expect(response.headers.get("location")).toBe("https://bahn.test/invite/fehlgeschlagen?grund=ungueltig");
    expect(response.headers.get("set-cookie")).toMatch(/pending_invite=;/);
  });
});
