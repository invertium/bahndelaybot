import { delayMinutes, currentLeg, transitous } from "@/lib/transport";
import { getOwnedJourney } from "@/lib/journeys";
import { getMemberSession } from "@/lib/membership";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const member = await getMemberSession(request.headers);
  if (!member) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await context.params;
  const stored = await getOwnedJourney(member.session.user.id, id);
  if (!stored) return Response.json({ error: "Reise nicht gefunden" }, { status: 404 });
  try {
    const plan = await transitous.refreshJourney(stored.plan);
    const activeLeg = currentLeg(plan);
    return Response.json({
      plan,
      currentLeg: activeLeg,
      delayMinutes: activeLeg ? delayMinutes(activeLeg, "arrival") : delayMinutes(plan, "arrival"),
      stale: false,
      updatedAt: plan.updatedAt,
    });
  } catch (error) {
    console.error("Live refresh failed", error);
    const activeLeg = currentLeg(stored.plan);
    return Response.json({
      plan: stored.plan,
      currentLeg: activeLeg,
      delayMinutes: activeLeg ? delayMinutes(activeLeg, "arrival") : delayMinutes(stored.plan, "arrival"),
      stale: true,
      updatedAt: stored.plan.updatedAt,
    });
  }
}
