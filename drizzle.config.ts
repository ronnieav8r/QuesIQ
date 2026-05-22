import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle migrations.");
}

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
});
