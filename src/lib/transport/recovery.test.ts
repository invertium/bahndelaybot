import { describe, expect, it, vi } from "vitest";
import type { DbJourneyDetails } from "@/lib/import/db-journey";
import type { JourneyPlan, StopCall, TransportProvider } from "./types";
import { planDbRecovery } from "./recovery";

const place = (id: string, name = id) => ({ id, name });
const stop = (id: string, arrival: string, departure = arrival): StopCall => ({
  stop: place(id),
  scheduledArrival: arrival,
  predictedArrival: arrival,
  scheduledDeparture: departure,
  predictedDeparture: departure,
});

function onward(id: string, origin: string, arrival: string, lineName: string): JourneyPlan {
  return {
    id,
    origin: place(origin),
    destination: place("mainz", "Mainz Hbf"),
    scheduledDeparture: origin === "fra-airport" ? "2026-08-27T19:59:00.000Z" : "2026-08-27T19:20:00.000Z",
    scheduledArrival: arrival,
    transfers: 0,
    legs: [{
      id: `${id}-leg`, mode: "train", lineName, origin: place(origin), destination: place("mainz", "Mainz Hbf"),
      scheduledDeparture: origin === "fra-airport" ? "2026-08-27T19:59:00.000Z" : "2026-08-27T19:20:00.000Z",
      scheduledArrival: arrival, cancelled: false, stopCalls: [],
    }],
    realtimeAvailable: true,
    updatedAt: "2026-08-27T18:05:00.000Z",
  };
}

describe("live DB recovery planning", () => {
  it("keeps the delayed current train to Frankfurt Airport and changes to ICE 22", async () => {
    const booked: JourneyPlan = {
      id: "booked", origin: place("muc", "München Hbf"), destination: place("mainz", "Mainz Hbf"),
      scheduledDeparture: "2026-08-27T15:28:00.000Z", predictedDeparture: "2026-08-27T16:21:00.000Z",
      scheduledArrival: "2026-08-27T19:18:00.000Z", transfers: 1, realtimeAvailable: true, updatedAt: "2026-08-27T18:05:00.000Z",
      legs: [{ id: "ice512", mode: "train", lineName: "ICE 512", origin: place("muc"), destination: place("mannheim"), scheduledDeparture: "2026-08-27T15:28:00.000Z", predictedDeparture: "2026-08-27T16:21:00.000Z", scheduledArrival: "2026-08-27T18:26:00.000Z", predictedArrival: "2026-08-27T18:58:00.000Z", cancelled: false, stopCalls: [] },
        { id: "ic2347", mode: "train", lineName: "IC 2347", origin: place("mannheim"), destination: place("mainz"), scheduledDeparture: "2026-08-27T18:39:00.000Z", scheduledArrival: "2026-08-27T19:18:00.000Z", cancelled: false, stopCalls: [] }],
    };
    const details: DbJourneyDetails = {
      candidate: { origin: "München Hbf", destination: "Mainz Hbf", departure: booked.scheduledDeparture, resolvedUrl: "db-link", ambiguous: [] },
      bookedPlan: booked,
      currentTrain: {
        lineName: "ICE 512", tripId: "ice512", cancelled: false,
        stops: [stop("muc", "2026-08-27T16:21:00.000Z"), stop("stuttgart", "2026-08-27T18:18:00.000Z", "2026-08-27T18:23:00.000Z"), stop("mannheim", "2026-08-27T18:58:00.000Z", "2026-08-27T19:04:00.000Z"), stop("fra-airport", "2026-08-27T19:33:00.000Z", "2026-08-27T19:35:00.000Z")],
      },
    };
    const provider = {
      searchLocations: vi.fn(async (query: string) => [place(query)]),
      planJourney: vi.fn(async ({ origin }: { origin: { id: string } }) => {
        if (origin.id === "fra-airport") return [onward("ice22", origin.id, "2026-08-27T20:18:00.000Z", "ICE 22")];
        if (origin.id === "stuttgart") return [onward("stuttgart-route", origin.id, "2026-08-27T20:49:00.000Z", "ICE 590")];
        return [onward("mannheim-route", origin.id, "2026-08-27T20:40:00.000Z", "S6")];
      }),
    } as unknown as TransportProvider;

    const ranked = await planDbRecovery(details, place("mainz", "Mainz Hbf"), provider, new Date("2026-08-27T18:05:00.000Z"));

    expect(ranked[0].recommended).toBe(true);
    expect(ranked[0].scheduledArrival).toBe("2026-08-27T20:18:00.000Z");
    expect(ranked[0].legs.map((leg) => leg.lineName)).toEqual(["ICE 512", "ICE 22"]);
    expect(ranked[0].transfers).toBe(1);
    expect(ranked.find((plan) => plan.id === "booked")?.recommended).toBe(false);
  });
});
