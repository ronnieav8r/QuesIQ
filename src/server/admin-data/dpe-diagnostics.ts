import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dpeDiagnosticEvents, dpePracticeSessions, users } from "@/server/db/schema";

export async function listAdminDpeReviewDiagnostics(limit = 100) {
  const events = await getDb()
    .select({
      code: dpeDiagnosticEvents.code,
      createdAt: dpeDiagnosticEvents.createdAt,
      id: dpeDiagnosticEvents.id,
      message: dpeDiagnosticEvents.message,
      metadata: dpeDiagnosticEvents.metadata,
      sessionId: dpeDiagnosticEvents.sessionId,
      severity: dpeDiagnosticEvents.severity,
      userEmail: users.email,
      userId: dpePracticeSessions.userId,
    })
    .from(dpeDiagnosticEvents)
    .leftJoin(dpePracticeSessions, eq(dpePracticeSessions.id, dpeDiagnosticEvents.sessionId))
    .leftJoin(users, eq(users.id, dpePracticeSessions.userId))
    .where(eq(dpeDiagnosticEvents.surface, "post_session_review"))
    .orderBy(desc(dpeDiagnosticEvents.createdAt))
    .limit(limit);

  return {
    events,
    totals: {
      errors: events.filter((event) => event.severity === "error").length,
      fallbackReviews: events.filter((event) => event.code === "review_fallback_saved").length,
      generatedReviews: events.filter((event) => event.code === "review_generated").length,
      reviewFailures: events.filter((event) => event.code === "review_generation_failed").length,
      totalEvents: events.length,
      warnings: events.filter((event) => event.severity === "warning").length,
    },
  };
}
