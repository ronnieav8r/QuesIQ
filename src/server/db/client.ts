import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/server/db/schema";

const globalForDb = globalThis as typeof globalThis & {
  quesiqPool?: Pool;
};

function getPool() {
  if (!globalForDb.quesiqPool) {
    globalForDb.quesiqPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return globalForDb.quesiqPool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
