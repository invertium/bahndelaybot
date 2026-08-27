import { describe, expect, it } from "vitest";
import { currentLeg, delayMinutes, hasRiskyTransfer, rankAlternatives } from "./helpers";
import { normalizeJourney } from "./normalize";
import type { JourneyPlan } from "./types";

const place = (id: string) => ({ id, name: id });
const plan = (id: string, arrival: string, transfers = 1): JourneyPlan => ({ id, origin: place("a"), destination: place("c"), scheduledDeparture: "2026-08-27T10:00:00Z", scheduledArrival: arrival, transfers, legs: [{ id: id + "1", mode: "train", origin: place("a"), destination: place("b"), scheduledDeparture: "2026-08-27T10:00:00Z", scheduledArrival: "2026-08-27T10:30:00Z", cancelled: false, stopCalls: [] }, { id: id + "2", mode: "train", origin: place("b"), destination: place("c"), scheduledDeparture: transfers ? "2026-08-27T10:35:00Z" : "2026-08-27T10:30:00Z", scheduledArrival: arrival, cancelled: false, stopCalls: [] }], realtimeAvailable: false, updatedAt: "2026-08-27T10:00:00Z" });
describe("transport helpers", () => {
  it("normalizes a MOTIS-shaped itinerary", () => { const p = normalizeJourney({ from: { id: "A", name: "A" }, to: { id: "B", name: "B" }, startTime: "2026-08-27T10:00:00Z", endTime: "2026-08-27T11:00:00Z", legs: [{ mode: "RAIL", from: { id: "A", name: "A" }, to: { id: "B", name: "B" }, startTime: "2026-08-27T10:00:00Z", endTime: "2026-08-27T11:00:00Z" }] }); expect(p.legs[0].mode).toBe("train"); expect(p.transfers).toBe(0); });
  it("calculates delay and current leg", () => { const p = plan("x", "2026-08-27T11:00:00Z"); p.legs[0].predictedArrival = "2026-08-27T10:40:00Z"; expect(delayMinutes(p.legs[0])).toBe(10); expect(currentLeg(p, new Date("2026-08-27T10:15:00Z"))?.id).toBe("x1"); });
  it("marks short transfers risky and labels alternatives", () => { const a = plan("a", "2026-08-27T11:00:00Z"); const b = plan("b", "2026-08-27T11:10:00Z", 0); expect(hasRiskyTransfer(a)).toBe(false); expect(hasRiskyTransfer(plan("r", "2026-08-27T11:00:00Z", 0))).toBe(true); expect(rankAlternatives([a,b])[0].label).toBe("fastest"); });
});
