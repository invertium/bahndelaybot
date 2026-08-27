import type { JourneyLeg, JourneyPlan, PlaceRef, StopCall, TransportMode } from "./types";

type UnknownRecord = Record<string, unknown>;

const modeMap: Record<string, TransportMode> = {
  RAIL: "train", TRAIN: "train", HIGHSPEED_RAIL: "train", LONG_DISTANCE: "train", NIGHT_RAIL: "train",
  REGIONAL_RAIL: "train", SUBURBAN: "train", SUBWAY: "subway", TRAM: "tram", BUS: "bus", COACH: "bus",
  FERRY: "ferry", FOOT: "walk", WALK: "walk",
};

const record = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number" ? String(value) : undefined;
const number = (value: unknown): number | undefined => typeof value === "number" && Number.isFinite(value) ? value : undefined;
const asIso = (value: unknown): string | undefined => {
  if (typeof value === "number") return new Date(value < 10_000_000_000 ? value * 1000 : value).toISOString();
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  return undefined;
};

export function normalizePlace(raw: unknown): PlaceRef {
  const root = record(raw);
  const place = record(root.place ?? root.stop ?? raw);
  const coordinates = record(place.coord);
  const name = string(place.name ?? place.stopName ?? place.id) ?? "Unbekannt";
  return {
    id: string(place.id ?? place.stopId ?? place.name) ?? "unknown",
    name,
    latitude: number(place.latitude) ?? number(place.lat) ?? number(coordinates.lat),
    longitude: number(place.longitude) ?? number(place.lon) ?? number(coordinates.lon),
  };
}

export function normalizeStopCall(raw: unknown): StopCall {
  const item = record(raw);
  return {
    stop: normalizePlace(item.stop ?? raw),
    scheduledArrival: asIso(item.scheduledArrival ?? item.plannedArrival ?? item.arrivalTime),
    predictedArrival: asIso(item.arrival ?? item.predictedArrival ?? item.estimatedArrival ?? item.realtimeArrival),
    scheduledDeparture: asIso(item.scheduledDeparture ?? item.plannedDeparture ?? item.departureTime),
    predictedDeparture: asIso(item.departure ?? item.predictedDeparture ?? item.estimatedDeparture ?? item.realtimeDeparture),
    platform: string(item.track ?? item.platform),
    cancelled: Boolean(item.cancelled),
  };
}

export function normalizeLeg(raw: unknown, index = 0): JourneyLeg {
  const item = record(raw);
  const fromRaw = item.from ?? item.origin;
  const toRaw = item.to ?? item.destination;
  const fromRecord = record(fromRaw);
  const toRecord = record(toRaw);
  const origin = normalizePlace(fromRaw);
  const destination = normalizePlace(toRaw);
  const calls = list(item.intermediateStops ?? item.stopCalls ?? item.stops).map(normalizeStopCall);
  const scheduledDeparture = asIso(item.scheduledStartTime ?? fromRecord.scheduledDeparture ?? item.scheduledDeparture ?? item.startTime) ?? new Date(0).toISOString();
  const scheduledArrival = asIso(item.scheduledEndTime ?? toRecord.scheduledArrival ?? item.scheduledArrival ?? item.endTime) ?? scheduledDeparture;
  const predictedDeparture = asIso(item.startTime ?? fromRecord.departure ?? item.realtimeStartTime ?? item.predictedDeparture);
  const predictedArrival = asIso(item.endTime ?? toRecord.arrival ?? item.realtimeEndTime ?? item.predictedArrival);
  const service = record(item.service);
  const rawMode = string(item.mode ?? item.transportMode)?.toUpperCase() ?? "OTHER";
  return {
    id: string(item.id) ?? `${string(item.tripId) ?? origin.id}-${destination.id}-${index}`,
    mode: modeMap[rawMode] ?? "other",
    lineName: string(item.displayName ?? item.tripShortName ?? service.name ?? item.lineName ?? item.routeShortName),
    tripId: string(service.tripId ?? item.tripId),
    origin,
    destination,
    scheduledDeparture,
    predictedDeparture: predictedDeparture !== scheduledDeparture ? predictedDeparture : undefined,
    scheduledArrival,
    predictedArrival: predictedArrival !== scheduledArrival ? predictedArrival : undefined,
    departurePlatform: string(fromRecord.track ?? fromRecord.platform ?? item.departurePlatform),
    arrivalPlatform: string(toRecord.track ?? toRecord.platform ?? item.arrivalPlatform),
    cancelled: Boolean(item.cancelled || fromRecord.cancelled || toRecord.cancelled),
    stopCalls: calls,
  };
}

export function normalizeJourney(raw: unknown, index = 0): JourneyPlan {
  const item = record(raw);
  const legs = list(item.legs ?? item.segments).map((leg, legIndex) => normalizeLeg(leg, legIndex));
  const first = legs[0];
  const last = legs.at(-1);
  const scheduledDeparture = asIso(item.scheduledStartTime ?? first?.scheduledDeparture) ?? new Date(0).toISOString();
  const scheduledArrival = asIso(item.scheduledEndTime ?? last?.scheduledArrival) ?? new Date(0).toISOString();
  const predictedDeparture = asIso(item.startTime ?? item.realtimeStartTime ?? first?.predictedDeparture);
  const predictedArrival = asIso(item.endTime ?? item.realtimeEndTime ?? last?.predictedArrival);
  const transfers = number(item.transfers);
  return {
    id: string(item.id) ?? `journey-${index}`,
    origin: normalizePlace(item.from ?? first?.origin),
    destination: normalizePlace(item.to ?? last?.destination),
    scheduledDeparture,
    predictedDeparture: predictedDeparture !== scheduledDeparture ? predictedDeparture : undefined,
    scheduledArrival,
    predictedArrival: predictedArrival !== scheduledArrival ? predictedArrival : undefined,
    transfers: transfers !== undefined ? transfers : Math.max(0, legs.filter((leg) => leg.mode !== "walk").length - 1),
    legs,
    realtimeAvailable: Boolean(item.realtimeAvailable ?? legs.some((leg) => leg.predictedArrival || leg.predictedDeparture)),
    updatedAt: new Date().toISOString(),
  };
}
