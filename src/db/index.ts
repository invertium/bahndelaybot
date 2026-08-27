import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createNeonDatabase(url: string) {
  return drizzle(neon(url), { schema });
}

type Database = ReturnType<typeof createNeonDatabase>;

function createDatabase(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  if (process.env.DATABASE_DRIVER === "postgres-js" && process.env.NODE_ENV !== "production") {
    const client = postgres(url, { max: 1, prepare: false });
    return drizzlePostgres(client, { schema }) as unknown as Database;
  }
  return createNeonDatabase(url);
}

export function getDb() {
  database ??= createDatabase();
  return database;
}
