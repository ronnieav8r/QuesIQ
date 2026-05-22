import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/server/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  quesiqPool?: Pool;
};

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured on the server.");
  }

  return databaseUrl;
}

function getPool() {
  if (!globalForDb.quesiqPool) {
    globalForDb.quesiqPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return globalForDb.quesiqPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
