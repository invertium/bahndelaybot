import { z } from "zod";
import { getMemberSession } from "@/lib/membership";
import { listOwnedJourneys, saveJourney } from "@/lib/journeys";
import { journeyPlanSchema } from "@/lib/validation";

const saveRequest = z.object({
  plan: journeyPlanSchema,
  importedVia: z.enum(["pdf", "link", "manual"]),
  title: z.string().max(120).optional(),
});

export async function GET(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  return Response.json({ journeys: await listOwnedJourneys(member.session.user.id) });
}

export async function POST(request: Request) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = saveRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Reise ist unvollständig", details: parsed.error.flatten() }, { status: 400 });
  const id = await saveJourney(member.session.user.id, parsed.data.plan, parsed.data.importedVia, parsed.data.title);
  return Response.json({ id }, { status: 201 });
}
