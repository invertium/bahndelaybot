import { extractText, getDocumentProxy } from "unpdf";
import type { JourneyLeg, PlaceRef } from "../transport/types";

export interface CandidateItinerary { origin?: PlaceRef; destination?: PlaceRef; departure?: string; arrival?: string; legs: Partial<JourneyLeg>[]; confidence: "high" | "medium" | "low"; ambiguous: string[]; rawText: string; }
export class PdfImportError extends Error { constructor(public code: "scanned" | "unreadable" | "ambiguous", message: string) { super(message); this.name = "PdfImportError"; } }
const station = (name: string): PlaceRef => ({ id: name.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, "-").replace(/^-|-$/g, ""), name: name.trim() });
const time = (date: string, clock: string): string | undefined => { const d = date.match(/(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?/); const t = clock.match(/(\d{1,2}):(\d{2})/); if (!d || !t) return; const year = d[3] ? (d[3].length === 2 ? 2000 + +d[3] : +d[3]) : new Date().getFullYear(); return new Date(year, +d[2] - 1, +d[1], +t[1], +t[2]).toISOString(); };
export function parseDbTicketText(rawText: string): CandidateItinerary {
  const text = rawText.replace(/[\u00a0\t]+/g, " ").replace(/\r/g, "").trim();
  if (!text || text.length < 30) throw new PdfImportError("scanned", "Die PDF enthält keinen auslesbaren Text (möglicherweise ein Scan).");
  const ambiguous: string[] = []; const date = text.match(/\b(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?)\b/)?.[1];
  const times = [...text.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map(m => m[1]);
  const dateValue = date && times[0] ? time(date, times[0]) : undefined; const arrValue = date && times[1] ? time(date, times[1]) : undefined;
  const route = text.match(/(?:Von|From)\s*[:\-]?\s*([^\n]+?)\s+(?:Nach|To)\s*[:\-]?\s*([^\n]+)/i);
  const arrow = text.match(/([^\n]{2,60})\s+(?:→|->|–|—)\s+([^\n]{2,60})/);
  const names = route ? [route[1], route[2]] : arrow ? [arrow[1], arrow[2]] : [];
  if (!names.length) ambiguous.push("Start und Ziel konnten nicht sicher erkannt werden.");
  if (times.length < 2) ambiguous.push("Abfahrts- und Ankunftszeit fehlen oder sind mehrdeutig.");
  if (times.length > 4) ambiguous.push("Mehrere mögliche Zeiten gefunden.");
  const origin = names[0] ? station(names[0].replace(/\s+(?:am|ab)\s+\d.*$/i, "")) : undefined;
  const destination = names[1] ? station(names[1].replace(/\s+(?:am|ab)\s+\d.*$/i, "")) : undefined;
  if (!date) ambiguous.push("Reisedatum fehlt.");
  if (ambiguous.length) return { origin, destination, departure: dateValue, arrival: arrValue, legs: [], confidence: "low", ambiguous, rawText: text };
  return { origin, destination, departure: dateValue, arrival: arrValue, legs: [], confidence: "medium", ambiguous: [], rawText: text };
}
export async function extractDbTicket(input: Uint8Array | ArrayBuffer): Promise<CandidateItinerary> {
  try { const pdf = await getDocumentProxy(input instanceof Uint8Array ? input : new Uint8Array(input)); const result = await extractText(pdf, { mergePages: true }); const text = String(result.text); return parseDbTicketText(text); }
  catch (error) { if (error instanceof PdfImportError) throw error; throw new PdfImportError("unreadable", "Die PDF konnte nicht gelesen werden."); }
}
