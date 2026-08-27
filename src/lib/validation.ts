import { z } from "zod";

export const placeSchema = z.object({
  id: z.string().min(1).max(500),
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const stopCallSchema = z.object({
  stop: placeSchema,
  scheduledArrival: z.iso.datetime().optional(),
  predictedArrival: z.iso.datetime().optional(),
  scheduledDeparture: z.iso.datetime().optional(),
  predictedDeparture: z.iso.datetime().optional(),
  platform: z.string().max(50).optional(),
  cancelled: z.boolean().optional(),
});

export const journeyLegSchema = z.object({
  id: z.string().min(1).max(1000),
  mode: z.enum(["train", "subway", "tram", "bus", "ferry", "walk", "other"]),
  lineName: z.string().max(100).optional(),
  tripId: z.string().max(1000).optional(),
  origin: placeSchema,
  destination: placeSchema,
  scheduledDeparture: z.iso.datetime(),
  predictedDeparture: z.iso.datetime().optional(),
  scheduledArrival: z.iso.datetime(),
  predictedArrival: z.iso.datetime().optional(),
  departurePlatform: z.string().max(50).optional(),
  arrivalPlatform: z.string().max(50).optional(),
  cancelled: z.boolean(),
  stopCalls: z.array(stopCallSchema).max(200),
});

export const journeyPlanSchema = z.object({
  id: z.string().min(1).max(4000),
  origin: placeSchema,
  destination: placeSchema,
  scheduledDeparture: z.iso.datetime(),
  predictedDeparture: z.iso.datetime().optional(),
  scheduledArrival: z.iso.datetime(),
  predictedArrival: z.iso.datetime().optional(),
  transfers: z.number().int().min(0).max(20),
  legs: z.array(journeyLegSchema).min(1).max(30),
  realtimeAvailable: z.boolean(),
  updatedAt: z.iso.datetime(),
});
