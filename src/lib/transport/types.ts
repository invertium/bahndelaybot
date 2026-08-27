export type TransportMode = "train" | "subway" | "tram" | "bus" | "ferry" | "walk" | "other";

export interface PlaceRef {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

export interface StopCall {
  stop: PlaceRef;
  scheduledArrival?: string;
  predictedArrival?: string;
  scheduledDeparture?: string;
  predictedDeparture?: string;
  platform?: string;
  cancelled?: boolean;
}

export interface JourneyLeg {
  id: string;
  mode: TransportMode;
  lineName?: string;
  tripId?: string;
  origin: PlaceRef;
  destination: PlaceRef;
  scheduledDeparture: string;
  predictedDeparture?: string;
  scheduledArrival: string;
  predictedArrival?: string;
  departurePlatform?: string;
  arrivalPlatform?: string;
  cancelled: boolean;
  stopCalls: StopCall[];
}

export interface JourneyPlan {
  id: string;
  origin: PlaceRef;
  destination: PlaceRef;
  scheduledDeparture: string;
  predictedDeparture?: string;
  scheduledArrival: string;
  predictedArrival?: string;
  transfers: number;
  legs: JourneyLeg[];
  realtimeAvailable: boolean;
  updatedAt: string;
}

export interface JourneySearchRequest {
  origin: PlaceRef;
  destination: PlaceRef;
  departure?: string;
  arrival?: string;
  results?: number;
}

export interface TransportProvider {
  searchLocations(query: string): Promise<PlaceRef[]>;
  planJourney(request: JourneySearchRequest): Promise<JourneyPlan[]>;
  refreshJourney(journey: JourneyPlan): Promise<JourneyPlan>;
  getTrip(tripId: string): Promise<JourneyLeg | null>;
}

export type AlternativeLabel = "fastest" | "fewer-transfers" | "more-buffer";

export interface RankedAlternative extends JourneyPlan {
  label: AlternativeLabel;
  recommended: boolean;
  riskyTransfer: boolean;
}
