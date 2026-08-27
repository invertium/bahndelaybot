import { z } from "zod";
import { parseDbLinkCandidate, UnsafeJourneyLinkError } from "@/lib/import";
import { getMemberSession } from "@/lib/membership";
import { transitous } from "@/lib/transport";

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = z.object({ url: z.string().url().max(4000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Gültigen DB-Link eingeben" }, { status: 400 });
  try {
    const candidate = parseDbLinkCandidate(parsed.data.url);
    const [origins, destinations] = await Promise.all([
      candidate.origin ? transitous.searchLocations(candidate.origin) : Promise.resolve([]),
      candidate.destination ? transitous.searchLocations(candidate.destination) : Promise.resolve([]),
    ]);
    const plans = origins[0] && destinations[0]
      ? await transitous.planJourney({ origin: origins[0], destination: destinations[0], departure: candidate.departure, results: 5 }).catch(() => [])
      : [];
    return Response.json({ candidate, matches: { origins, destinations }, plans, needsConfirmation: plans.length !== 1 });
  } catch (error) {
    if (error instanceof UnsafeJourneyLinkError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Link import failed", error);
    return Response.json({ error: "DB-Link konnte nicht verarbeitet werden" }, { status: 500 });
  }
}
