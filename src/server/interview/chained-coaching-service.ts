import { withInterviewOperation } from "./operation-context";
import { InterviewLimitError } from "./beta-safety";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { sessions, interviewTurnBasedTurns, interviewQuestionPracticeAttempts } from "@/server/db/schema";
import { clearAnsweredPriorities } from "./question-preferences";
import { ensureNativeExecutionSnapshot, resolveInterviewExecutionSnapshot } from "./execution-config";
import { CoachingOperationError, listCoachingOperations, runCoachingOperation } from "./coaching-operations";
import { renderChainedCoachingSpeech, type TurnBasedResult } from "./turn-based";
import { planLegacyCoachingTurn } from "./coaching-exercise-adapter";
import { generateControlledCoachingTurn } from "./controlled-coaching-turn";
import { CoachingServerClock } from "./coaching-timing";
import { controlledPracticeMode } from "./controlled-mode-policy";

export const coachingTurnInputSchema = z.object({
  sessionId: z.string().uuid(), turnIndex: z.number().int().min(0).max(50),
  answerTranscript: z.string().trim().max(12000).optional(),
  explicitChoiceIntent: z.enum(["try_again", "more_feedback", "ask_que", "move_on"]).optional(),
  // Legacy clients send these; authority is always the stored session and turn records.
  snapshot: z.unknown().optional(), priorTurns: z.array(z.unknown()).max(200).optional(),
}).strict();

export async function chainedCoachingConfig() {
  const snapshot = await resolveInterviewExecutionSnapshot({ modeKey: "coaching", styleKey: "friendly", interviewContext: { preferredName: "Candidate", targetRole: "", targetCompany: "", jobDescription: "" } }, "native");
  return snapshot.executionConfig.effective;
}

export function operationHistory(rows: Array<{ result: Record<string, unknown> | null }>) {
  return rows.flatMap(({ result }) => result ? [
    ...(result.transcript ? [{ role: "user", text: String(result.transcript) }] : []),
    ...(result.feedback ? [{ role: "assistant", text: String(result.feedback) }] : []),
    ...(result.question ? [{ role: "assistant", text: String(result.question) }] : []),
  ] : []);
}

export function assertCoachingAction(previous: Record<string, unknown> | null | undefined, answer?: string, choice?: string) {
  if (previous?.done) throw new CoachingOperationError("conversation_complete", "The conversation is complete.");
  if (!previous) {
    if (answer || choice) throw new CoachingOperationError("invalid_opening", "Start with an opening question.", 400);
    return;
  }
  if (!answer?.trim()) throw new CoachingOperationError("answer_required", "An answer is required.", 400);
  const choosing = ["brief_feedback_choice", "more_feedback"].includes(String(previous.state));
  if (choosing !== Boolean(choice)) throw new CoachingOperationError("invalid_action", choosing ? "Choose what happens next." : "Answer the current question before choosing another action.", 400);
}

export async function mobileCoachingTurn(userId: string, body: z.infer<typeof coachingTurnInputSchema>, timing = new CoachingServerClock()) {
  const [session] = await getDb().select().from(sessions).where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, userId)));
  if (!session || (session.modeKey !== "coaching" && !controlledPracticeMode(session.contextSnapshot))) throw new CoachingOperationError("session_not_found", "Controlled practice session was not found.", 404);
  if (session.endedAt) throw new CoachingOperationError("session_ended", "This session has ended.");
  const rows = await listCoachingOperations(body.sessionId, userId);
  const snapshot = await ensureNativeExecutionSnapshot(session.id, userId);
  const config = snapshot.executionConfig!.effective;
  if (config.engine !== "turn_based") throw new CoachingOperationError("wrong_engine", "This session retains its original Realtime engine.", 409);
  const startedAt = Date.now();
  const plan = () => planLegacyCoachingTurn({ rows, turnIndex: body.turnIndex, mode: controlledPracticeMode(snapshot),
    limit: Math.min(snapshot.turnBasedQuestionCount ?? config.maxTurns, config.maxTurns), answer: body.answerTranscript, choice: body.explicitChoiceIntent });
  const { result, replayed } = await runCoachingOperation({ targetId: session.id, userId, turnIndex: body.turnIndex, parent: "session",
    payload: { answerTranscript: body.answerTranscript, explicitChoiceIntent: body.explicitChoiceIntent },
    validate: () => { plan(); },
    generate: async () => {
      const control = plan();
      const result = await generateControlledCoachingTurn({ control, config, userId, sessionId: session.id, snapshot, timing,
        turnIndex: body.turnIndex, answer: body.answerTranscript, choice: body.explicitChoiceIntent,
        priorTurns: operationHistory(rows.filter((row) => row.turnIndex < body.turnIndex)) });
      return { ...result, transcript: body.answerTranscript, runtimeConfig: config };
    },
    finalize: async (tx, result) => {
      const control = plan();
      const answered = control.before.phase === "awaiting_answer" && !body.explicitChoiceIntent && Boolean(body.answerTranscript?.trim());
      await tx.insert(interviewTurnBasedTurns).values({ sessionId: session.id, userId, modeKey: session.modeKey,
        turnIndex: body.turnIndex, answerTranscript: answered ? body.answerTranscript : undefined, feedback: result.feedback,
        archetypeId: "archetypeId" in result && typeof result.archetypeId === "string" ? result.archetypeId : undefined,
        question: answered ? control.before.question!.text : result.question || "Coaching complete.", routingReason: result.routingReason, targetSkill: result.targetSkill });
      if (answered && body.answerTranscript!.trim().split(/\s+/).length >= 8) {
        const queue = snapshot.selectedQuestionQueueContext ?? (snapshot.selectedQuestionContext ? [snapshot.selectedQuestionContext] : []);
        const question = queue[control.before.primaryQuestionIndex - 1];
        if (question) {
          await tx.update(interviewQuestionPracticeAttempts).set({ status: "answered", retryCount: control.before.attemptIndex - 1, updatedAt: new Date() }).where(and(eq(interviewQuestionPracticeAttempts.userId, userId), eq(interviewQuestionPracticeAttempts.sessionId, session.id), eq(interviewQuestionPracticeAttempts.questionId, question.id)));
          await clearAnsweredPriorities(userId, snapshot.interviewContext.jobTargetId, [question.id], tx);
        }
      }
    },
  });
  if (replayed) timing.generation("replay");
  // Generated audio is returned only, never stored in the operation ledger.
  await ensureNativeExecutionSnapshot(session.id, userId);
  let limit: import("@quesiq/interview-contracts").InterviewLimitOutcome | undefined;
  let speech: { questionAudioBase64?: string; questionAudioMimeType?: string } = {};
  // Replays return the validated text, never automatically buy another rendition.
  if (!replayed) {
    try { speech = await withInterviewOperation(`speech:${session.id}:${body.turnIndex}`, () => renderChainedCoachingSpeech({ result: result as TurnBasedResult, config: result.runtimeConfig, sessionId: session.id, userId, timing })); }
    catch (error) { if (!(error instanceof InterviewLimitError)) throw error; limit = error.outcome; }
  }
  await ensureNativeExecutionSnapshot(session.id, userId);
  timing.mark("responseReadyMs");
  return { ...result, inspection: undefined, runtimeConfig: undefined, ...speech, replayed, limit,
    validation: result.validation ?? { corrected: false, issues: [], passed: true },
    pipeline: { telemetry: timing.snapshot(), completedAt: new Date().toISOString(), responseAndSpeechMs: Date.now() - startedAt,
      textModel: result.runtimeConfig.textModel, transcriptionModel: result.runtimeConfig.transcriptionModel, ttsModel: result.runtimeConfig.ttsModel, ttsVoice: result.runtimeConfig.ttsVoice },
  };
}
