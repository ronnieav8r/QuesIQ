// Imported only by deterministic test entrypoints, never application code.
import { loadEnvFile } from "node:process";
try { loadEnvFile(".env.local"); } catch { /* The runner may supply its environment. */ }
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost"].includes(target.hostname) || target.port !== "5433" || target.pathname !== "/quesiq_local") throw new Error("Synthetic Interview tests require the local database and a non-production process.");
process.env.INTERVIEW_SYNTHETIC_TEST = "1";
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("External requests forbidden in synthetic Interview tests. Install an explicit in-process mock.");
  return original(input, init);
};
