import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { journeyLegs, journeys } from "@/db/schema";
import type { JourneyLeg, JourneyPlan } from "@/lib/transport/types";

export type JourneyImportMethod = "pdf" | "link" | "manual";

export async function saveJourney(userId: string, plan: JourneyPlan, importedVia: JourneyImportMethod, title?: string) {
  const db = getDb();
  const journeyId = randomUUID();
  const created = db
      .insert(journeys)
      .values({
        id: journeyId,
        userId,
        title: title?.trim() || `${plan.origin.name} → ${plan.destination.name}`,
        originId: plan.origin.id,
        originName: plan.origin.name,
        destinationId: plan.destination.id,
        destinationName: plan.destination.name,
        scheduledDeparture: new Date(plan.scheduledDeparture),
        scheduledArrival: new Date(plan.scheduledArrival),
        status: statusForPlan(plan),
        importedVia,
        providerJourneyId: plan.id,
        providerPayload: { plan },
      })
      .returning({ id: journeys.id });
  if (!plan.legs.length) {
    await db.batch([created]);
    return journeyId;
  }
  const legQuery = db.insert(journeyLegs).values(
        plan.legs.map((leg, sequence) => ({
          journeyId,
          sequence,
          mode: leg.mode,
          lineName: leg.lineName,
          tripId: leg.tripId,
          originId: leg.origin.id,
          originName: leg.origin.name,
          destinationId: leg.destination.id,
          destinationName: leg.destination.name,
          scheduledDeparture: new Date(leg.scheduledDeparture),
          predictedDeparture: leg.predictedDeparture ? new Date(leg.predictedDeparture) : null,
          scheduledArrival: new Date(leg.scheduledArrival),
          predictedArrival: leg.predictedArrival ? new Date(leg.predictedArrival) : null,
          departurePlatform: leg.departurePlatform,
          arrivalPlatform: leg.arrivalPlatform,
          cancelled: leg.cancelled,
          stopCalls: leg.stopCalls,
        })),
  );
  await db.batch([created, legQuery]);
  return journeyId;
}

export function statusForPlan(plan: JourneyPlan, now = new Date()) {
  if (plan.legs.some((leg) => leg.cancelled)) return "cancelled" as const;
  if (now < new Date(plan.scheduledDeparture)) return "upcoming" as const;
  if (now > new Date(plan.predictedArrival ?? plan.scheduledArrival)) return "completed" as const;
  return "active" as const;
}

export async function listOwnedJourneys(userId: string) {
  const rows = await getDb()
    .select()
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(desc(journeys.scheduledDeparture));
  const now = new Date();
  return rows.map((row) => {
    const status = row.status === "cancelled"
      ? "cancelled"
      : now < row.scheduledDeparture
        ? "upcoming"
        : now > row.scheduledArrival
          ? "completed"
          : "active";
    return {
      ...row,
      status,
      scheduledDeparture: row.scheduledDeparture.toISOString(),
      scheduledArrival: row.scheduledArrival.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getOwnedJourney(userId: string, journeyId: string) {
  const [row] = await getDb()
    .select()
    .from(journeys)
    .where(and(eq(journeys.id, journeyId), eq(journeys.userId, userId)))
    .limit(1);
  if (!row) return null;
  const legs = await getDb()
    .select()
    .from(journeyLegs)
    .where(eq(journeyLegs.journeyId, row.id))
    .orderBy(asc(journeyLegs.sequence));
  const plan = (row.providerPayload as { plan?: JourneyPlan } | null)?.plan ?? planFromRows(row, legs);
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    importedVia: row.importedVia,
    status: statusForPlan(plan),
    plan,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function planFromRows(
  row: typeof journeys.$inferSelect,
  rows: (typeof journeyLegs.$inferSelect)[],
): JourneyPlan {
  const legs: JourneyLeg[] = rows.map((leg) => ({
    id: leg.id,
    mode: leg.mode as JourneyLeg["mode"],
    lineName: leg.lineName ?? undefined,
    tripId: leg.tripId ?? undefined,
    origin: { id: leg.originId, name: leg.originName },
    destination: { id: leg.destinationId, name: leg.destinationName },
    scheduledDeparture: leg.scheduledDeparture.toISOString(),
    predictedDeparture: leg.predictedDeparture?.toISOString(),
    scheduledArrival: leg.scheduledArrival.toISOString(),
    predictedArrival: leg.predictedArrival?.toISOString(),
    departurePlatform: leg.departurePlatform ?? undefined,
    arrivalPlatform: leg.arrivalPlatform ?? undefined,
    cancelled: leg.cancelled,
    stopCalls: leg.stopCalls,
  }));
  return {
    id: row.providerJourneyId ?? row.id,
    origin: { id: row.originId, name: row.originName },
    destination: { id: row.destinationId, name: row.destinationName },
    scheduledDeparture: row.scheduledDeparture.toISOString(),
    scheduledArrival: row.scheduledArrival.toISOString(),
    transfers: Math.max(0, legs.filter((leg) => leg.mode !== "walk").length - 1),
    legs,
    realtimeAvailable: legs.some((leg) => Boolean(leg.predictedArrival || leg.predictedDeparture)),
    updatedAt: row.updatedAt.toISOString(),
  };
}
