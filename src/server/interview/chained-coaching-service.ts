import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { sessions } from "@/server/db/schema";
import { getInterviewRuntimeConfig } from "./runtime-configs";
import { CoachingOperationError, listCoachingOperations, runCoachingOperation } from "./coaching-operations";
import { renderChainedCoachingSpeech, runTurnBasedInterviewTurn, type TurnBasedResult } from "./turn-based";

export const coachingTurnInputSchema = z.object({
  sessionId: z.string().uuid(), turnIndex: z.number().int().min(0).max(50),
  answerTranscript: z.string().trim().max(12000).optional(),
  explicitChoiceIntent: z.enum(["try_again", "more_feedback", "ask_que", "move_on"]).optional(),
  // Legacy clients send these; authority is always the stored session and turn records.
  snapshot: z.unknown().optional(), priorTurns: z.array(z.unknown()).max(200).optional(),
}).strict();

export async function chainedCoachingConfig() {
  return { ...await getInterviewRuntimeConfig("coaching"), enabled: true, engine: "turn_based" as const,
    textModel: "gpt-5.4-mini", transcriptionModel: "gpt-live-transcribe", ttsModel: "gpt-4o-mini-tts", ttsVoice: "marin" };
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

export async function mobileCoachingTurn(userId: string, body: z.infer<typeof coachingTurnInputSchema>) {
  const [session] = await getDb().select().from(sessions).where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, userId)));
  if (!session || session.modeKey !== "coaching") throw new CoachingOperationError("session_not_found", "Coaching session was not found.", 404);
  if (session.endedAt) throw new CoachingOperationError("session_ended", "This session has ended.");
  const rows = await listCoachingOperations(body.sessionId, userId);
  if (body.turnIndex > rows.filter((row) => row.status === "completed").length) throw new CoachingOperationError("turn_order", "Complete the current turn before advancing.");
  if (body.turnIndex === 0 && (body.answerTranscript || body.explicitChoiceIntent)) throw new CoachingOperationError("invalid_opening", "Opening turns cannot contain an answer.", 400);
  if (body.turnIndex > 0 && !body.answerTranscript) throw new CoachingOperationError("answer_required", "An answer is required.", 400);
  assertCoachingAction(rows.find((row) => row.turnIndex === body.turnIndex - 1)?.result, body.answerTranscript, body.explicitChoiceIntent);
  const config = await chainedCoachingConfig();
  const startedAt = Date.now();
  const { result, replayed } = await runCoachingOperation({ targetId: session.id, userId, turnIndex: body.turnIndex,
    payload: { answerTranscript: body.answerTranscript, explicitChoiceIntent: body.explicitChoiceIntent },
    generate: async () => {
      const result = await runTurnBasedInterviewTurn({ config, userId, turnInput: {
        sessionId: session.id, snapshot: session.contextSnapshot, turnIndex: body.turnIndex,
        answerTranscript: body.answerTranscript, explicitChoiceIntent: body.explicitChoiceIntent,
        priorTurns: operationHistory(rows.filter((row) => row.turnIndex < body.turnIndex)), chainedCoachingProof: true, skipSpeech: true,
      } });
      if (!result) throw new Error("Session not found.");
      return { ...result, runtimeConfig: config };
    },
  });
  // Generated audio is returned only, never stored in the operation ledger.
  const speech = await renderChainedCoachingSpeech({ result: result as TurnBasedResult, config: result.runtimeConfig, sessionId: session.id, userId });
  return { ...result, inspection: undefined, runtimeConfig: undefined, ...speech, replayed,
    validation: result.validation ?? { corrected: false, issues: [], passed: true },
    pipeline: { completedAt: new Date().toISOString(), responseAndSpeechMs: Date.now() - startedAt,
      textModel: result.runtimeConfig.textModel, transcriptionModel: result.runtimeConfig.transcriptionModel, ttsModel: result.runtimeConfig.ttsModel, ttsVoice: result.runtimeConfig.ttsVoice },
  };
}
