import "server-only";
import type { JourneyLeg, JourneyPlan, JourneySearchRequest, PlaceRef, TransportProvider } from "./types";
import { normalizeJourney, normalizeLeg, normalizePlace } from "./normalize";

export interface TransitousOptions { baseUrl?: string; fetcher?: typeof fetch; token?: string; userAgent?: string; }
export class TransitousProvider implements TransportProvider {
  private base: string; private fetcher: typeof fetch; private token?: string; private userAgent: string;
  constructor(options: TransitousOptions = {}) {
    this.base = (options.baseUrl ?? "https://api.transitous.org").replace(/\/$/, "");
    this.fetcher = options.fetcher ?? fetch;
    this.token = options.token;
    this.userAgent = options.userAgent ?? process.env.TRANSITOUS_USER_AGENT ?? "BahnDelay/0.1 (contact unavailable)";
  }
  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    headers.set("user-agent", this.userAgent);
    if (this.token) headers.set("authorization", `Bearer ${this.token}`);
    const res = await this.fetcher(`${this.base}${path}`, { ...init, headers, redirect: "error", signal: init?.signal ?? AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Transitous request failed (${res.status})`);
    if (!res.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new Error("Transitous returned non-JSON data");
    const length = Number(res.headers.get("content-length"));
    if (Number.isFinite(length) && length > 2_000_000) throw new Error("Transitous response too large");
    const text = await res.text();
    if (text.length > 2_000_000) throw new Error("Transitous response too large");
    try { return JSON.parse(text); } catch { throw new Error("Transitous returned malformed JSON"); }
  }
  async searchLocations(query: string): Promise<PlaceRef[]> {
    const data = await this.request(`/api/v1/geocode?${new URLSearchParams({ text: query })}`);
    return (Array.isArray(data) ? data : []).slice(0, 8).map(normalizePlace);
  }
  async planJourney(request: JourneySearchRequest): Promise<JourneyPlan[]> {
    const placeValue = (place: PlaceRef) =>
      place.id && !place.id.startsWith("coordinate:")
        ? place.id
        : `${place.latitude},${place.longitude}`;
    const params = new URLSearchParams({
      fromPlace: placeValue(request.origin),
      toPlace: placeValue(request.destination),
      numItineraries: String(request.results ?? 3),
      maxItineraries: String(request.results ?? 3),
      timetableView: "true",
      detailedLegs: "false",
      language: "de",
    });
    if (request.departure ?? request.arrival) params.set("time", request.departure ?? request.arrival!);
    if (request.arrival && !request.departure) params.set("arriveBy", "true");
    const data = await this.request(`/api/v6/plan?${params}`);
    const payload = data as { itineraries?: unknown[] };
    return (payload.itineraries ?? []).map((item, index) => normalizeJourney(item, index));
  }
  async refreshJourney(journey: JourneyPlan): Promise<JourneyPlan> {
    if (!journey.id.startsWith("journey-")) {
      try {
        const params = new URLSearchParams({ itineraryId: journey.id, detailedLegs: "false", language: "de" });
        const data = await this.request(`/api/v6/refresh-itinerary?${params}`);
        const payload = data as { itinerary?: unknown };
        return normalizeJourney(payload.itinerary ?? data, 0);
      } catch {
        // Itinerary IDs can expire after timetable changes; a fresh search is the safe fallback.
      }
    }
    const refreshed = await this.planJourney({ origin: journey.origin, destination: journey.destination, departure: new Date().toISOString(), results: 5 });
    return refreshed[0] ?? journey;
  }
  async getTrip(tripId: string): Promise<JourneyLeg | null> {
    const data = await this.request(`/api/v6/trip?${new URLSearchParams({ tripId, detailedLegs: "false", language: "de" })}`);
    const payload = data as { legs?: unknown[]; itinerary?: { legs?: unknown[] } };
    const leg = payload.legs?.[0] ?? payload.itinerary?.legs?.[0] ?? data;
    return leg ? normalizeLeg(leg) : null;
  }
}
export const transitous = new TransitousProvider();
