import type { JourneyLeg, JourneyPlan, RankedAlternative } from "./types";

export function delayMinutes(item: JourneyLeg | JourneyPlan, at = "arrival"): number {
  const scheduled = at === "departure" ? item.scheduledDeparture : item.scheduledArrival;
  const predicted = at === "departure" ? item.predictedDeparture : item.predictedArrival;
  return predicted ? Math.round((Date.parse(predicted) - Date.parse(scheduled)) / 60000) : 0;
}
export function currentLeg(plan: JourneyPlan, now = new Date()): JourneyLeg | undefined {
  const t = now.getTime();
  return plan.legs.find(l => t < Date.parse(l.scheduledArrival) || (l.predictedArrival && t < Date.parse(l.predictedArrival))) ?? plan.legs.at(-1);
}
export function hasRiskyTransfer(plan: JourneyPlan, minimumMinutes = 5): boolean {
  for (let i = 1; i < plan.legs.length; i++) { const gap = (Date.parse(plan.legs[i].scheduledDeparture) - Date.parse(plan.legs[i - 1].scheduledArrival)) / 60000; if (gap < minimumMinutes || plan.legs[i - 1].cancelled || plan.legs[i].cancelled) return true; }
  return false;
}
export function rankAlternatives(plans: JourneyPlan[]): RankedAlternative[] {
  const unique = plans.filter((p, i, all) => all.findIndex(q => q.legs.map(l => `${l.origin.id}:${l.destination.id}:${l.scheduledDeparture}`).join("|") === p.legs.map(l => `${l.origin.id}:${l.destination.id}:${l.scheduledDeparture}`).join("|") ) === i);
  const fastest = [...unique].sort((a,b) => Date.parse(a.predictedArrival ?? a.scheduledArrival)-Date.parse(b.predictedArrival ?? b.scheduledArrival))[0];
  const fewer = [...unique].sort((a,b) => a.transfers-b.transfers || Date.parse(a.scheduledArrival)-Date.parse(b.scheduledArrival))[0];
  const buffered = [...unique].sort((a,b) => Number(hasRiskyTransfer(a))-Number(hasRiskyTransfer(b)) || a.transfers-b.transfers)[0];
  return unique.map(p => ({ ...p, label: p === fastest ? "fastest" : p === fewer ? "fewer-transfers" : p === buffered ? "more-buffer" : "fastest", recommended: p === fastest, riskyTransfer: hasRiskyTransfer(p) }));
}
