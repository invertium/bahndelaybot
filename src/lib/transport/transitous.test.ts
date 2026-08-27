import { describe, expect, it, vi } from "vitest";
import { TransitousProvider } from "./transitous";

describe("TransitousProvider", () => {
  it("encodes location searches and bounds returned results", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(
      Array.from({ length: 10 }, (_, index) => ({ id: `stop-${index}`, name: `Stop ${index}` })),
    ));
    const provider = new TransitousProvider({ baseUrl: "https://transport.test", fetcher });

    const places = await provider.searchLocations("Frankfurt Flughafen");

    expect(fetcher).toHaveBeenCalledWith(
      "https://transport.test/api/v1/geocode?text=Frankfurt+Flughafen",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(places).toHaveLength(8);
  });

  it("normalizes journey plans returned by the provider", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ itineraries: [{
      id: "trip-1",
      from: { id: "muc", name: "München Hbf" },
      to: { id: "mainz", name: "Mainz Hbf" },
      startTime: "2026-08-27T16:30:00.000Z",
      endTime: "2026-08-27T20:18:00.000Z",
      legs: [{
        mode: "RAIL",
        displayName: "ICE 910",
        from: { id: "muc", name: "München Hbf" },
        to: { id: "mainz", name: "Mainz Hbf" },
        startTime: "2026-08-27T16:30:00.000Z",
        endTime: "2026-08-27T20:18:00.000Z",
      }],
    }] }));
    const provider = new TransitousProvider({ baseUrl: "https://transport.test", fetcher });

    const plans = await provider.planJourney({
      origin: { id: "muc", name: "München Hbf" },
      destination: { id: "mainz", name: "Mainz Hbf" },
      departure: "2026-08-27T15:28:00.000Z",
      results: 8,
    });

    expect(plans[0]).toMatchObject({ id: "trip-1", scheduledArrival: "2026-08-27T20:18:00.000Z" });
    expect(String(fetcher.mock.calls[0][0])).toContain("numItineraries=8");
  });

  it("rejects non-JSON and oversized responses", async () => {
    const nonJson = new TransitousProvider({ fetcher: vi.fn().mockResolvedValue(new Response("no", { headers: { "content-type": "text/plain" } })) });
    const oversized = new TransitousProvider({ fetcher: vi.fn().mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json", "content-length": "2000001" } })) });

    await expect(nonJson.searchLocations("Mainz")).rejects.toThrow("non-JSON");
    await expect(oversized.searchLocations("Mainz")).rejects.toThrow("too large");
  });
});
