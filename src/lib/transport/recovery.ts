import type { DbJourneyDetails } from "@/lib/import/db-journey";
import type { JourneyLeg, JourneyPlan, PlaceRef, StopCall, TransportProvider } from "./types";
import { rankAlternatives } from "./helpers";

function eventTime(stop: StopCall) {
  return stop.predictedArrival ?? stop.scheduledArrival ?? stop.predictedDeparture ?? stop.scheduledDeparture;
}

function currentTrainLeg(details: DbJourneyDetails, stop: StopCall): JourneyLeg | undefined {
  const train = details.currentTrain;
  const booked = details.bookedPlan;
  const firstStop = train?.stops[0];
  const departure = firstStop?.scheduledDeparture;
  const arrival = stop.scheduledArrival;
  if (!train || !booked || !firstStop || !departure || !arrival) return undefined;
  const stopIndex = train.stops.indexOf(stop);
  return {
    id: `${train.tripId}:${stop.stop.id}`,
    mode: "train",
    lineName: train.lineName,
    tripId: train.tripId,
    origin: firstStop.stop,
    destination: stop.stop,
    scheduledDeparture: departure,
    predictedDeparture: firstStop.predictedDeparture,
    scheduledArrival: arrival,
    predictedArrival: stop.predictedArrival,
    cancelled: train.cancelled,
    stopCalls: train.stops.slice(0, stopIndex + 1),
  };
}

function combine(details: DbJourneyDetails, stop: StopCall, onward: JourneyPlan): JourneyPlan | undefined {
  const current = currentTrainLeg(details, stop);
  const booked = details.bookedPlan;
  if (!current || !booked) return undefined;
  return {
    id: `db-recovery:${current.tripId}:${stop.stop.id}:${onward.id}`,
    origin: booked.origin,
    destination: onward.destination,
    scheduledDeparture: current.scheduledDeparture,
    predictedDeparture: current.predictedDeparture,
    scheduledArrival: onward.scheduledArrival,
    predictedArrival: onward.predictedArrival,
    transfers: onward.transfers + 1,
    legs: [current, ...onward.legs],
    realtimeAvailable: true,
    updatedAt: new Date().toISOString(),
  };
}

async function resolveStop(provider: TransportProvider, stop: StopCall): Promise<PlaceRef | undefined> {
  const matches = await provider.searchLocations(stop.stop.name);
  return matches[0];
}

export async function planDbRecovery(
  details: DbJourneyDetails,
  destination: PlaceRef,
  provider: TransportProvider,
  now = new Date(),
) {
  const booked = details.bookedPlan;
  const train = details.currentTrain;
  if (!booked || !train || train.cancelled) return booked ? rankAlternatives([booked]) : [];
  const firstDeparture = train.stops[0]?.predictedDeparture ?? train.stops[0]?.scheduledDeparture;
  if (!firstDeparture || now.getTime() < Date.parse(firstDeparture) - 15 * 60_000) return rankAlternatives([booked]);

  const futureStops = train.stops
    .filter((stop) => {
      const value = eventTime(stop);
      return value && Date.parse(value) > now.getTime() + 3 * 60_000;
    })
    .slice(0, 5);
  const recovered = await Promise.all(futureStops.map(async (stop) => {
    const departure = eventTime(stop);
    if (!departure) return [];
    try {
      const origin = await resolveStop(provider, stop);
      if (!origin) return [];
      const onward = await provider.planJourney({ origin, destination, departure, results: 4 });
      return onward.flatMap((plan) => {
        const combined = combine(details, stop, plan);
        return combined ? [combined] : [];
      });
    } catch {
      return [];
    }
  }));
  return rankAlternatives([booked, ...recovered.flat()]);
}
