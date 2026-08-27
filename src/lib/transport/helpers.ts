import type { JourneyLeg, JourneyPlan, RankedAlternative } from "./types";

export function delayMinutes(
  item: JourneyLeg | JourneyPlan,
  at = "arrival",
): number {
  const scheduled =
    at === "departure" ? item.scheduledDeparture : item.scheduledArrival;
  const predicted =
    at === "departure" ? item.predictedDeparture : item.predictedArrival;
  return predicted
    ? Math.round((Date.parse(predicted) - Date.parse(scheduled)) / 60000)
    : 0;
}
export function currentLeg(
  plan: JourneyPlan,
  now = new Date(),
): JourneyLeg | undefined {
  const t = now.getTime();
  return (
    plan.legs.find(
      (l) =>
        t < Date.parse(l.scheduledArrival) ||
        (l.predictedArrival && t < Date.parse(l.predictedArrival)),
    ) ?? plan.legs.at(-1)
  );
}
export function hasRiskyTransfer(
  plan: JourneyPlan,
  minimumMinutes = 5,
): boolean {
  if (plan.legs.some((leg) => leg.cancelled)) return true;
  const rides = plan.legs.filter((leg) => leg.mode !== "walk");
  for (let i = 1; i < rides.length; i++) {
    const previousArrival =
      rides[i - 1].predictedArrival ?? rides[i - 1].scheduledArrival;
    const nextDeparture =
      rides[i].predictedDeparture ?? rides[i].scheduledDeparture;
    const gap =
      (Date.parse(nextDeparture) - Date.parse(previousArrival)) / 60000;
    if (gap < minimumMinutes) return true;
  }
  return false;
}

function recommendationScore(plan: JourneyPlan) {
  const arrival = Date.parse(plan.predictedArrival ?? plan.scheduledArrival);
  const transferPenalty = plan.transfers * 10 * 60_000;
  const riskPenalty = hasRiskyTransfer(plan) ? 20 * 60_000 : 0;
  const rides = plan.legs.filter((leg) => leg.mode !== "walk");
  const missedConnection = rides.some((leg, index) => {
    if (index === 0) return false;
    const previous = rides[index - 1];
    const previousArrival = previous.predictedArrival ?? previous.scheduledArrival;
    const departure = leg.predictedDeparture ?? leg.scheduledDeparture;
    return Date.parse(departure) < Date.parse(previousArrival);
  });
  return arrival + transferPenalty + riskPenalty + (missedConnection ? 24 * 60 * 60_000 : 0);
}

export function rankAlternatives(plans: JourneyPlan[]): RankedAlternative[] {
  const unique = plans.filter(
    (p, i, all) =>
      all.findIndex(
        (q) =>
          q.legs
            .map(
              (l) =>
                `${l.origin.id}:${l.destination.id}:${l.scheduledDeparture}`,
            )
            .join("|") ===
          p.legs
            .map(
              (l) =>
                `${l.origin.id}:${l.destination.id}:${l.scheduledDeparture}`,
            )
            .join("|"),
      ) === i,
  );
  const fastest = [...unique].sort(
    (a, b) =>
      Date.parse(a.predictedArrival ?? a.scheduledArrival) -
      Date.parse(b.predictedArrival ?? b.scheduledArrival),
  )[0];
  const fewer = [...unique].sort(
    (a, b) =>
      a.transfers - b.transfers ||
      Date.parse(a.scheduledArrival) - Date.parse(b.scheduledArrival),
  )[0];
  const buffered = [...unique].sort(
    (a, b) =>
      Number(hasRiskyTransfer(a)) - Number(hasRiskyTransfer(b)) ||
      a.transfers - b.transfers,
  )[0];
  const recommended = [...unique].sort(
    (a, b) => recommendationScore(a) - recommendationScore(b),
  )[0];
  return unique
    .map((p) => ({
      ...p,
      label:
        p === fastest
          ? ("fastest" as const)
          : p === fewer
            ? ("fewer-transfers" as const)
            : p === buffered
              ? ("more-buffer" as const)
              : ("fastest" as const),
      recommended: p === recommended,
      riskyTransfer: hasRiskyTransfer(p),
    }))
    .sort(
      (a, b) =>
        Number(b.recommended) - Number(a.recommended) ||
        recommendationScore(a) - recommendationScore(b),
    );
}
