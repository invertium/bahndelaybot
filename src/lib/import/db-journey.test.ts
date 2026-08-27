import { describe, expect, it, vi } from "vitest";
import { dbLocalTimeToIso, fetchDbJourneyDetails } from "./db-journey";

const link = "https://int.bahn.de/en/buchung/start?vbid=2112412b-b348-4912-9a5c-ca51ef3a31ba";

describe("DB journey reconstruction", () => {
  it("interprets DB wall-clock times explicitly in Europe/Berlin", () => {
    expect(dbLocalTimeToIso("2026-08-27T17:28:00")).toBe("2026-08-27T15:28:00.000Z");
    expect(dbLocalTimeToIso("2026-01-27T17:28:00")).toBe("2026-01-27T16:28:00.000Z");
  });

  it("reconstructs the booked journey and the current train's downstream stops", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({
        startOrt: "München Hbf",
        zielOrt: "Mainz Hbf",
        hinfahrtDatum: "2026-08-27T17:28:00",
        hinfahrtRecon: "opaque-recon",
      }))
      .mockResolvedValueOnce(Response.json({ verbindungen: [{
        tripId: "booked-trip",
        umstiegsAnzahl: 1,
        verbindungsAbschnitte: [{
          journeyId: "ice-512-journey",
          abfahrtsOrt: "München Hbf",
          abfahrtsOrtExtId: "muc",
          ankunftsOrt: "Mannheim Hbf",
          ankunftsOrtExtId: "mannheim",
          abfahrt: { sollzeit: "2026-08-27T17:28:00", echtzeit: "2026-08-27T18:21:00" },
          ankunft: { sollzeit: "2026-08-27T20:26:00", echtzeit: "2026-08-27T20:58:00" },
          verkehrsmittel: { name: "ICE 512", typ: "PUBLICTRANSPORT", produktGattung: "ICE" },
          halte: [],
        }, {
          journeyId: "ic-2347-journey",
          abfahrtsOrt: "Mannheim Hbf",
          ankunftsOrt: "Mainz Hbf",
          abfahrt: { sollzeit: "2026-08-27T20:39:00" },
          ankunft: { sollzeit: "2026-08-27T21:18:00" },
          verkehrsmittel: { name: "IC 2347", typ: "PUBLICTRANSPORT", produktGattung: "EC_IC" },
          halte: [],
        }],
      }] }))
      .mockResolvedValueOnce(Response.json({
        zugName: "ICE 512",
        cancelled: false,
        halte: [{ name: "München Hbf", extId: "muc", abfahrt: { sollzeit: "2026-08-27T17:28:00", echtzeit: "2026-08-27T18:21:00" } },
          { name: "Mannheim Hbf", extId: "mannheim", ankunft: { sollzeit: "2026-08-27T20:26:00", echtzeit: "2026-08-27T20:58:00" }, abfahrt: { sollzeit: "2026-08-27T20:34:00", echtzeit: "2026-08-27T21:04:00" } },
          { name: "Frankfurt(M) Flughafen Fernbf", extId: "fra-airport", ankunft: { sollzeit: "2026-08-27T21:08:00", echtzeit: "2026-08-27T21:33:00" }, abfahrt: { sollzeit: "2026-08-27T21:10:00", echtzeit: "2026-08-27T21:35:00" } }],
      }));

    const details = await fetchDbJourneyDetails(link, { fetcher });

    expect(details.candidate.departure).toBe("2026-08-27T15:28:00.000Z");
    expect(details.bookedPlan?.legs.map((leg) => leg.lineName)).toEqual(["ICE 512", "IC 2347"]);
    expect(details.bookedPlan?.legs[0].predictedArrival).toBe("2026-08-27T18:58:00.000Z");
    expect(details.currentTrain?.stops.at(-1)?.stop.name).toContain("Flughafen");
    expect(fetcher.mock.calls[1][0]).toBe("https://int.bahn.de/web/api/angebote/recon");
    expect(fetcher.mock.calls[2][0]).toContain("/web/api/reiseloesung/fahrt?");
    expect(JSON.stringify(details.candidate)).not.toContain("opaque-recon");
  });
});
