import { z } from "zod";
import {
  fetchDbJourneyDetails,
  parseDbLinkCandidate,
  DbLinkImportError,
  UnsafeJourneyLinkError,
} from "@/lib/import";
import { getMemberSession } from "@/lib/membership";
import { planDbRecovery, rankAlternatives, transitous } from "@/lib/transport";

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member)
    return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = z
    .object({ url: z.string().url().max(4000) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Gültigen DB-Link eingeben" },
      { status: 400 },
    );
  try {
    const isVbid = parsed.data.url.includes("vbid=");
    const details = isVbid ? await fetchDbJourneyDetails(parsed.data.url) : undefined;
    const candidate = details?.candidate ?? parseDbLinkCandidate(parsed.data.url);
    const [origins, destinations] = await Promise.all([
      candidate.origin
        ? transitous.searchLocations(candidate.origin)
        : Promise.resolve([]),
      candidate.destination
        ? transitous.searchLocations(candidate.destination)
        : Promise.resolve([]),
    ]);
    let plans: ReturnType<typeof rankAlternatives> = [];
    if (origins[0] && destinations[0]) {
      const now = new Date();
      const started = details?.bookedPlan
        ? Date.parse(details.bookedPlan.predictedDeparture ?? details.bookedPlan.scheduledDeparture) <= now.getTime() + 15 * 60_000
        : false;
      const recovered = details
        ? await planDbRecovery(details, destinations[0], transitous, now)
        : [];
      if (started && recovered.length) {
        plans = recovered.slice(0, 8);
      } else {
        const searched = await transitous.planJourney({
          origin: origins[0], destination: destinations[0], departure: candidate.departure, results: 8,
        }).catch(() => []);
        plans = rankAlternatives([...(details?.bookedPlan ? [details.bookedPlan] : []), ...searched]).slice(0, 8);
      }
    }
    return Response.json({
      candidate,
      matches: { origins, destinations },
      plans,
      needsConfirmation: plans.length !== 1,
    });
  } catch (error) {
    if (
      error instanceof UnsafeJourneyLinkError ||
      error instanceof DbLinkImportError
    )
      return Response.json(
        { error: error.message },
        {
          status:
            error instanceof DbLinkImportError && error.code === "not-found"
              ? 404
              : 400,
        },
      );
    return Response.json(
      { error: "DB-Link konnte nicht verarbeitet werden" },
      { status: 502 },
    );
  }
}
