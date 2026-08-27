import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JourneyPlan } from "@/lib/transport/types";

const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  fetchDbConnection: vi.fn(),
  searchLocations: vi.fn(),
  planJourney: vi.fn(),
}));

vi.mock("@/lib/membership", () => ({ getMemberSession: mocks.member }));
vi.mock("@/lib/import", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/import")>()),
  fetchDbConnection: mocks.fetchDbConnection,
}));
vi.mock("@/lib/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/transport")>()),
  transitous: {
    searchLocations: mocks.searchLocations,
    planJourney: mocks.planJourney,
  },
}));

import { POST } from "./route";

const place = (id: string, name: string) => ({ id, name });

function plan(id: string, arrival: string, transfers: number, services: string[]): JourneyPlan {
  const origin = place("muc", "München Hbf");
  const destination = place("mainz", "Mainz Hbf");
  return {
    id,
    origin,
    destination,
    scheduledDeparture: "2026-08-27T16:30:00.000Z",
    scheduledArrival: arrival,
    transfers,
    legs: services.map((lineName, index) => ({
      id: `${id}-${index}`,
      mode: "train" as const,
      lineName,
      origin: index === 0 ? origin : place("fra-airport", "Frankfurt Flughafen Fernbahnhof"),
      destination: index === services.length - 1 ? destination : place("fra-airport", "Frankfurt Flughafen Fernbahnhof"),
      scheduledDeparture: index === 0 ? "2026-08-27T16:30:00.000Z" : "2026-08-27T19:59:00.000Z",
      scheduledArrival: index === 0 ? "2026-08-27T19:38:00.000Z" : arrival,
      cancelled: false,
      stopCalls: [],
    })),
    realtimeAvailable: true,
    updatedAt: "2026-08-27T17:00:00.000Z",
  };
}

describe("POST /api/import/link", () => {
  beforeEach(() => {
    mocks.member.mockResolvedValue({ session: { user: { id: "member-1" } }, role: "member" });
    mocks.fetchDbConnection.mockResolvedValue({
      origin: "München Hbf",
      destination: "Mainz Hbf",
      departure: "2026-08-27T15:28:00.000Z",
      resolvedUrl: "db-link",
      ambiguous: [],
    });
    mocks.searchLocations
      .mockResolvedValueOnce([place("muc", "München Hbf")])
      .mockResolvedValueOnce([place("mainz", "Mainz Hbf")]);
    mocks.planJourney.mockResolvedValue([
      plan("via-city", "2026-08-27T20:13:00.000Z", 2, ["ICE 512", "ICE 2", "RB10"]),
      plan("via-airport", "2026-08-27T20:18:00.000Z", 1, ["ICE 910", "ICE 22"]),
    ]);
  });

  it("imports the reported vbid and puts the practical Frankfurt Airport option first", async () => {
    const url = "https://int.bahn.de/en/buchung/start?vbid=2112412b-b348-4912-9a5c-ca51ef3a31ba";
    const response = await POST(new Request("https://bahn.test/api/import/link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }));
    const body = await response.json() as { plans: Array<JourneyPlan & { recommended: boolean }> };

    expect(response.status).toBe(200);
    expect(mocks.fetchDbConnection).toHaveBeenCalledWith(url);
    expect(mocks.planJourney).toHaveBeenCalledWith(expect.objectContaining({ results: 8 }));
    expect(body.plans[0]).toMatchObject({
      id: "via-airport",
      scheduledArrival: "2026-08-27T20:18:00.000Z",
      transfers: 1,
      recommended: true,
    });
    expect(body.plans[0].legs.map((leg) => leg.lineName)).toEqual(["ICE 910", "ICE 22"]);
  });
});
