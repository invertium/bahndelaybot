import { describe, expect, it } from "vitest";
import { fetchDbLink, parseDbLink, UnsafeJourneyLinkError } from "./link";
import { parseDbTicketText } from "./pdf";
describe("DB import", () => {
  it("allows DB links and validates every redirect", async () => { expect(parseDbLink("https://reiseauskunft.bahn.de/bin/query.exe/en").hostname).toBe("reiseauskunft.bahn.de"); const fetcher = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } }); await expect(fetchDbLink("https://bahn.de/x", { fetcher })).rejects.toBeInstanceOf(UnsafeJourneyLinkError); });
  it("rejects non DB hosts", () => { expect(() => parseDbLink("https://bahn.de.evil.example/x")).toThrow(UnsafeJourneyLinkError); });
  it("returns explicit ambiguity for incomplete ticket text", () => { const result = parseDbTicketText("My DB Reise\nBerlin Hbf\n27.08.2026"); expect(result.ambiguous.length).toBeGreaterThan(0); });
  it("extracts a clear German route", () => { const result = parseDbTicketText("Von Berlin Hbf Nach Hamburg Hbf\n27.08.2026\n10:00 11:45"); expect(result.origin?.name).toBe("Berlin Hbf"); expect(result.destination?.name).toBe("Hamburg Hbf"); expect(result.ambiguous).toEqual([]); });
});
