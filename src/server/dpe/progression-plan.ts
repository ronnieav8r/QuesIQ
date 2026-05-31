export type DpeXpEventKey =
  | "dpe_session_completed"
  | "dpe_review_completed"
  | "dpe_acs_area_task_practiced"
  | "dpe_score_threshold_reached"
  | "dpe_weak_acs_resolved";

export type DpeXpWiringPoint = {
  eventKey: DpeXpEventKey;
  notes: string;
  route: string;
  trigger: string;
};

// Planning-only map for the next migration-backed XP implementation slice.
// This file does not persist awards and does not touch shared progression tables.
export const dpeXpWiringPlan: DpeXpWiringPoint[] = [
  {
    eventKey: "dpe_session_completed",
    notes: "Award once when status transitions to completed.",
    route: "PATCH /api/dpe/practice-sessions/[id]",
    trigger: "Request body sets status=completed with endedAt.",
  },
  {
    eventKey: "dpe_review_completed",
    notes: "Award once when review status is generated and saved.",
    route: "POST /api/dpe/practice-sessions/[id]/review",
    trigger: "saveDpeReview writes generated review JSON.",
  },
  {
    eventKey: "dpe_acs_area_task_practiced",
    notes: "Award by unique area.task key per user to avoid duplicate farming.",
    route: "PATCH /api/dpe/practice-sessions/[id] and POST /api/dpe/practice-sessions/[id]/artifact",
    trigger: "Completed session has transcript answers with acsArea+acsTask.",
  },
  {
    eventKey: "dpe_score_threshold_reached",
    notes: "Award on readiness threshold (for example >= 4) from generated review scores.",
    route: "POST /api/dpe/practice-sessions/[id]/review",
    trigger: "review.scores.checkrideReadiness crosses threshold.",
  },
  {
    eventKey: "dpe_weak_acs_resolved",
    notes: "Award when historical weak focus no longer appears in latest review.",
    route: "POST /api/dpe/practice-sessions/[id]/review",
    trigger: "Compare current weak focus keys with prior stored weak focus keys.",
  },
];
