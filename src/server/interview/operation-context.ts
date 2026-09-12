import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<{ id: string; attempt: number }>();
export function withInterviewOperation<T>(id: string, work: () => Promise<T>) {
  return context.run({ id, attempt: 0 }, work);
}
export function nextInterviewAttempt() {
  const scope = context.getStore();
  return scope ? `${scope.id}:${scope.attempt++}` : undefined;
}
/** Only local test processes may declare intercepted/synthetic provider work. */
export function isInterviewSyntheticTest() {
  if (process.env.NODE_ENV === "production" || process.env.INTERVIEW_SYNTHETIC_TEST !== "1") return false;
  try { const url = new URL(process.env.DATABASE_URL ?? ""); return ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "5433" && url.pathname === "/quesiq_local"; }
  catch { return false; }
}
