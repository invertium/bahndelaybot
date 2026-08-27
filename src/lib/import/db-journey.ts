import { z } from "zod";
import type { JourneyLeg, JourneyPlan, PlaceRef, StopCall, TransportMode } from "@/lib/transport/types";
import { DbLinkImportError, normalizeDbConnection, parseVbid, type DbLinkCandidate } from "./link";

const API_ORIGIN = "https://int.bahn.de";
const MAX_BYTES = 1024 * 1024;

const dbTimeSchema = z.object({
  sollzeit: z.string().min(1).max(40),
  echtzeit: z.string().min(1).max(40).optional(),
}).strip();

const dbStopSchema = z.object({
  id: z.string().max(300).optional(),
  extId: z.string().max(300).optional(),
  name: z.string().min(1).max(200),
  gleis: z.string().max(50).optional(),
  ezGleis: z.string().max(50).optional(),
  ankunft: dbTimeSchema.optional(),
  abfahrt: dbTimeSchema.optional(),
}).strip();

const dbTransportSchema = z.object({
  name: z.string().max(100).optional(),
  mittelText: z.string().max(100).optional(),
  typ: z.string().max(50).optional(),
  produktGattung: z.string().max(50).optional(),
}).strip();

const dbSegmentSchema = z.object({
  journeyId: z.string().min(1).max(4000).optional(),
  abfahrtsOrt: z.string().min(1).max(200),
  abfahrtsOrtExtId: z.string().max(300).optional(),
  ankunftsOrt: z.string().min(1).max(200),
  ankunftsOrtExtId: z.string().max(300).optional(),
  abfahrt: dbTimeSchema,
  ankunft: dbTimeSchema,
  halte: z.array(dbStopSchema).max(200).default([]),
  verkehrsmittel: dbTransportSchema,
  originCancelled: z.boolean().optional(),
  destinationCancelled: z.boolean().optional(),
}).strip();

const dbConnectionSchema = z.object({
  tripId: z.string().min(1).max(4000),
  umstiegsAnzahl: z.number().int().min(0).max(30).default(0),
  verbindungsAbschnitte: z.array(dbSegmentSchema).min(1).max(30),
}).strip();

const reconSchema = z.object({
  verbindungen: z.array(dbConnectionSchema).min(1).max(10),
}).strip();

const sharedConnectionSchema = z.object({
  startOrt: z.string().trim().min(1).max(200),
  zielOrt: z.string().trim().min(1).max(200),
  hinfahrtDatum: z.string().trim().min(1).max(80),
  hinfahrtRecon: z.string().min(1).max(10_000),
}).strip();

const fullJourneySchema = z.object({
  zugName: z.string().min(1).max(100),
  halte: z.array(dbStopSchema).min(2).max(300),
  cancelled: z.boolean().default(false),
}).strip();

const berlinFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function dbLocalTimeToIso(value: string) {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (!match) throw new DbLinkImportError("malformed", "Die DB-Reisezeit ist ungültig.");
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  const wallClockUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const parts = Object.fromEntries(berlinFormatter.formatToParts(new Date(wallClockUtc)).map((part) => [part.type, part.value]));
  const representedUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const parsed = new Date(wallClockUtc - (representedUtc - wallClockUtc));
  if (Number.isNaN(parsed.getTime())) throw new DbLinkImportError("malformed", "Die DB-Reisezeit ist ungültig.");
  return parsed.toISOString();
}

async function boundedJson(response: Response) {
  if (!response.ok) throw new DbLinkImportError(response.status === 404 ? "not-found" : "malformed", "Die DB-Verbindung konnte nicht geladen werden.");
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new DbLinkImportError("not-json", "Die DB-Antwort ist kein JSON.");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) throw new DbLinkImportError("too-large", "Die DB-Antwort ist zu groß.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new DbLinkImportError("too-large", "Die DB-Antwort ist zu groß.");
  try { return JSON.parse(text) as unknown; } catch { throw new DbLinkImportError("malformed", "Die DB-Antwort enthält ungültiges JSON."); }
}

function place(id: string | undefined, name: string): PlaceRef {
  return { id: id || `db:${name.toLowerCase()}`, name };
}

function time(value: z.infer<typeof dbTimeSchema>) {
  return {
    scheduled: dbLocalTimeToIso(value.sollzeit),
    predicted: value.echtzeit ? dbLocalTimeToIso(value.echtzeit) : undefined,
  };
}

function mode(transport: z.infer<typeof dbTransportSchema>): TransportMode {
  const value = `${transport.typ ?? ""} ${transport.produktGattung ?? ""}`.toUpperCase();
  if (value.includes("WALK")) return "walk";
  if (value.includes("BUS")) return "bus";
  if (value.includes("TRAM")) return "tram";
  if (value.includes("SUBWAY") || value.includes("U_BAHN")) return "subway";
  return "train";
}

function stopCall(stop: z.infer<typeof dbStopSchema>): StopCall {
  const arrival = stop.ankunft ? time(stop.ankunft) : undefined;
  const departure = stop.abfahrt ? time(stop.abfahrt) : undefined;
  return {
    stop: place(stop.extId ?? stop.id, stop.name),
    scheduledArrival: arrival?.scheduled,
    predictedArrival: arrival?.predicted,
    scheduledDeparture: departure?.scheduled,
    predictedDeparture: departure?.predicted,
    platform: stop.ezGleis ?? stop.gleis,
  };
}

function segmentToLeg(segment: z.infer<typeof dbSegmentSchema>, index: number): JourneyLeg {
  const departure = time(segment.abfahrt);
  const arrival = time(segment.ankunft);
  return {
    id: segment.journeyId ?? `db-leg-${index}`,
    mode: mode(segment.verkehrsmittel),
    lineName: segment.verkehrsmittel.name ?? segment.verkehrsmittel.mittelText,
    tripId: segment.journeyId,
    origin: place(segment.abfahrtsOrtExtId, segment.abfahrtsOrt),
    destination: place(segment.ankunftsOrtExtId, segment.ankunftsOrt),
    scheduledDeparture: departure.scheduled,
    predictedDeparture: departure.predicted,
    scheduledArrival: arrival.scheduled,
    predictedArrival: arrival.predicted,
    cancelled: Boolean(segment.originCancelled || segment.destinationCancelled),
    stopCalls: segment.halte.map(stopCall),
  };
}

function connectionToPlan(connection: z.infer<typeof dbConnectionSchema>): JourneyPlan {
  const legs = connection.verbindungsAbschnitte.map(segmentToLeg);
  const first = legs[0];
  const last = legs.at(-1)!;
  return {
    id: `db-${connection.tripId}`,
    origin: first.origin,
    destination: last.destination,
    scheduledDeparture: first.scheduledDeparture,
    predictedDeparture: first.predictedDeparture,
    scheduledArrival: last.scheduledArrival,
    predictedArrival: last.predictedArrival,
    transfers: connection.umstiegsAnzahl,
    legs,
    realtimeAvailable: legs.some((leg) => leg.predictedArrival || leg.predictedDeparture),
    updatedAt: new Date().toISOString(),
  };
}

export interface DbCurrentTrain {
  lineName: string;
  tripId: string;
  cancelled: boolean;
  stops: StopCall[];
}

export interface DbJourneyDetails {
  candidate: DbLinkCandidate;
  bookedPlan?: JourneyPlan;
  currentTrain?: DbCurrentTrain;
}

export async function fetchDbJourneyDetails(input: string, options: { fetcher?: typeof fetch; timeoutMs?: number } = {}): Promise<DbJourneyDetails> {
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const vbid = parseVbid(input);
    const sharedResponse = await fetcher(`${API_ORIGIN}/web/api/angebote/verbindung/${encodeURIComponent(vbid)}`, {
      headers: { accept: "application/json" }, redirect: "error", signal: controller.signal,
    });
    const shared = sharedConnectionSchema.safeParse(await boundedJson(sharedResponse));
    if (!shared.success) throw new DbLinkImportError("malformed", "Die geteilte DB-Verbindung ist ungültig.");
    const candidate = normalizeDbConnection({
      startOrt: shared.data.startOrt,
      zielOrt: shared.data.zielOrt,
      hinfahrtDatum: dbLocalTimeToIso(shared.data.hinfahrtDatum),
    }, input);

    const reconResponse = await fetcher(`${API_ORIGIN}/web/api/angebote/recon`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        ctxRecon: shared.data.hinfahrtRecon,
        klasse: "KLASSE_2",
        reisende: [{ typ: "ERWACHSENER", anzahl: 1, alter: [], ermaessigungen: [] }],
      }),
      redirect: "error",
      signal: controller.signal,
    });
    const recon = reconSchema.safeParse(await boundedJson(reconResponse));
    if (!recon.success) return { candidate };
    const connection = recon.data.verbindungen[0];
    const bookedPlan = connectionToPlan(connection);
    const firstTrain = connection.verbindungsAbschnitte.find((segment) => mode(segment.verkehrsmittel) === "train" && segment.journeyId);
    if (!firstTrain?.journeyId) return { candidate, bookedPlan };

    const fullResponse = await fetcher(`${API_ORIGIN}/web/api/reiseloesung/fahrt?${new URLSearchParams({ journeyId: firstTrain.journeyId, poly: "false" })}`, {
      headers: { accept: "application/json" }, redirect: "error", signal: controller.signal,
    });
    const full = fullJourneySchema.safeParse(await boundedJson(fullResponse));
    if (!full.success) return { candidate, bookedPlan };
    return {
      candidate,
      bookedPlan,
      currentTrain: {
        lineName: full.data.zugName,
        tripId: firstTrain.journeyId,
        cancelled: full.data.cancelled,
        stops: full.data.halte.map(stopCall),
      },
    };
  } catch (error) {
    if (error instanceof DbLinkImportError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new DbLinkImportError("timeout", "Die DB-Anfrage hat zu lange gedauert.");
    throw new DbLinkImportError("malformed", "Die DB-Verbindung konnte nicht gelesen werden.");
  } finally {
    clearTimeout(timeout);
  }
}
