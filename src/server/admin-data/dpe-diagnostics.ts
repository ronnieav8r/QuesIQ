import { desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { dpeDiagnosticEvents, dpePracticeSessions, users } from "@/server/db/schema";

export async function listAdminDpeReviewDiagnostics(limit = 100) {
  const events = await getDb()
    .select({
      acsTitle: dpePracticeSessions.acsTitle,
      code: dpeDiagnosticEvents.code,
      createdAt: dpeDiagnosticEvents.createdAt,
      id: dpeDiagnosticEvents.id,
      message: dpeDiagnosticEvents.message,
      metadata: dpeDiagnosticEvents.metadata,
      mode: dpePracticeSessions.mode,
      sessionId: dpeDiagnosticEvents.sessionId,
      severity: dpeDiagnosticEvents.severity,
      transcriptJson: dpePracticeSessions.transcriptJson,
      userEmail: users.email,
      userId: dpePracticeSessions.userId,
    })
    .from(dpeDiagnosticEvents)
    .leftJoin(dpePracticeSessions, eq(dpePracticeSessions.id, dpeDiagnosticEvents.sessionId))
    .leftJoin(users, eq(users.id, dpePracticeSessions.userId))
    .where(eq(dpeDiagnosticEvents.surface, "post_session_review"))
    .orderBy(desc(dpeDiagnosticEvents.createdAt))
    .limit(limit);
  const enrichedEvents = events.map((event) => {
    const evidence = getEvidenceSource(event.transcriptJson);
    const targetTrackTitle = getTargetTrackTitle(event.transcriptJson, event.acsTitle);

    return {
      ...event,
      evidenceSource: evidence.source,
      evidenceTurns: evidence.turns,
      targetTrackTitle,
      transcriptJson: undefined,
    };
  });

  return {
    events: enrichedEvents,
    totals: {
      errors: enrichedEvents.filter((event) => event.severity === "error").length,
      fallbackReviews: enrichedEvents.filter((event) => event.code === "review_fallback_saved").length,
      generatedReviews: enrichedEvents.filter((event) => event.code === "review_generated").length,
      missingTargetTracks: enrichedEvents.filter((event) => !event.targetTrackTitle).length,
      reviewFailures: enrichedEvents.filter((event) => event.code === "review_generation_failed").length,
      totalEvents: enrichedEvents.length,
      typedEvidence: enrichedEvents.filter((event) => event.evidenceSource === "typed").length,
      voiceEvidence: enrichedEvents.filter((event) => event.evidenceSource === "voice").length,
      warnings: enrichedEvents.filter((event) => event.severity === "warning").length,
    },
  };
}

function getEvidenceSource(transcriptJson: unknown) {
  if (!isRecord(transcriptJson)) {
    return { source: "typed" as const, turns: 0 };
  }

  const voiceArtifact = isRecord(transcriptJson.voiceArtifact) ? transcriptJson.voiceArtifact : null;
  const turns = Array.isArray(voiceArtifact?.transcript) ? voiceArtifact.transcript.length : 0;

  return {
    source: turns > 0 ? ("voice" as const) : ("typed" as const),
    turns,
  };
}

function getTargetTrackTitle(transcriptJson: unknown, acsTitle: string | null) {
  if (!isRecord(transcriptJson)) {
    return acsTitle?.trim() || null;
  }

  const targetTrack = isRecord(transcriptJson.targetTrack) ? transcriptJson.targetTrack : null;
  const transcriptTitle =
    typeof targetTrack?.title === "string" ? targetTrack.title.trim() : "";

  return transcriptTitle || acsTitle?.trim() || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
