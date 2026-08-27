import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { journeys } from "@/db/schema";
import { getOwnedJourney } from "@/lib/journeys";
import { getMemberSession } from "@/lib/membership";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await context.params;
  const journey = await getOwnedJourney(member.session.user.id, id);
  return journey ? Response.json({ journey }) : Response.json({ error: "Reise nicht gefunden" }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const parsed = z.object({ title: z.string().min(1).max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Titel ungültig" }, { status: 400 });
  const { id } = await context.params;
  const [updated] = await getDb()
    .update(journeys)
    .set({ title: parsed.data.title, updatedAt: new Date() })
    .where(and(eq(journeys.id, id), eq(journeys.userId, member.session.user.id)))
    .returning({ id: journeys.id });
  return updated ? Response.json(updated) : Response.json({ error: "Reise nicht gefunden" }, { status: 404 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await context.params;
  const [deleted] = await getDb()
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.userId, member.session.user.id)))
    .returning({ id: journeys.id });
  return deleted ? new Response(null, { status: 204 }) : Response.json({ error: "Reise nicht gefunden" }, { status: 404 });
}
