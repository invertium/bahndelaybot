import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { StopCall } from "@/lib/transport/types";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const memberRole = pgEnum("member_role", ["admin", "member"]);
export const journeyStatus = pgEnum("journey_status", ["upcoming", "active", "completed", "cancelled"]);
export const importMethod = pgEnum("import_method", ["pdf", "link", "manual"]);

export const memberships = pgTable("memberships", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: memberRole("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invitation_token_hash_idx").on(table.tokenHash),
    index("invitation_email_idx").on(table.email),
  ],
);

export const journeys = pgTable(
  "journeys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    originId: text("origin_id").notNull(),
    originName: text("origin_name").notNull(),
    destinationId: text("destination_id").notNull(),
    destinationName: text("destination_name").notNull(),
    scheduledDeparture: timestamp("scheduled_departure", { withTimezone: true }).notNull(),
    scheduledArrival: timestamp("scheduled_arrival", { withTimezone: true }).notNull(),
    status: journeyStatus("status").notNull().default("upcoming"),
    importedVia: importMethod("imported_via").notNull(),
    providerJourneyId: text("provider_journey_id"),
    providerPayload: jsonb("provider_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("journey_user_time_idx").on(table.userId, table.scheduledDeparture)],
);

export const journeyLegs = pgTable(
  "journey_legs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    journeyId: uuid("journey_id")
      .notNull()
      .references(() => journeys.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    mode: text("mode").notNull(),
    lineName: text("line_name"),
    tripId: text("trip_id"),
    originId: text("origin_id").notNull(),
    originName: text("origin_name").notNull(),
    destinationId: text("destination_id").notNull(),
    destinationName: text("destination_name").notNull(),
    scheduledDeparture: timestamp("scheduled_departure", { withTimezone: true }).notNull(),
    predictedDeparture: timestamp("predicted_departure", { withTimezone: true }),
    scheduledArrival: timestamp("scheduled_arrival", { withTimezone: true }).notNull(),
    predictedArrival: timestamp("predicted_arrival", { withTimezone: true }),
    departurePlatform: text("departure_platform"),
    arrivalPlatform: text("arrival_platform"),
    cancelled: boolean("cancelled").notNull().default(false),
    stopCalls: jsonb("stop_calls").$type<StopCall[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex("journey_leg_sequence_idx").on(table.journeyId, table.sequence),
    index("journey_leg_trip_idx").on(table.tripId),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  membership: one(memberships),
  journeys: many(journeys),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const membershipRelations = relations(memberships, ({ one }) => ({
  user: one(user, { fields: [memberships.userId], references: [user.id] }),
}));

export const journeyRelations = relations(journeys, ({ one, many }) => ({
  user: one(user, { fields: [journeys.userId], references: [user.id] }),
  legs: many(journeyLegs),
}));

export const journeyLegRelations = relations(journeyLegs, ({ one }) => ({
  journey: one(journeys, { fields: [journeyLegs.journeyId], references: [journeys.id] }),
}));

export const schema = {
  user,
  session,
  account,
  verification,
  memberships,
  invitations,
  journeys,
  journeyLegs,
  userRelations,
  sessionRelations,
  accountRelations,
  membershipRelations,
  journeyRelations,
  journeyLegRelations,
};
