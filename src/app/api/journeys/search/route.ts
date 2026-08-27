import { z } from "zod";
import { getMemberSession } from "@/lib/membership";
import { transitous } from "@/lib/transport";
import { placeSchema } from "@/lib/validation";

const searchRequest = z.object({
  origin: placeSchema,
  destination: placeSchema,
  departure: z.iso.datetime().optional(),
  arrival: z.iso.datetime().optional(),
});

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = searchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Start, Ziel und Zeit prüfen" }, { status: 400 });
  try {
    const plans = await transitous.planJourney({ ...parsed.data, results: 5 });
    return Response.json({ plans });
  } catch (error) {
    console.error("Journey search failed", error);
    return Response.json({ error: "Verbindungssuche ist gerade nicht erreichbar" }, { status: 503 });
  }
}
