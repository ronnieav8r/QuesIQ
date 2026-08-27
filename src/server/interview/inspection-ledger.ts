import { asc, desc, inArray } from "drizzle-orm";

import type {
  SessionSetupSnapshot,
  VoiceSessionArtifactDraft,
  VoiceTranscriptTurn,
} from "@/product/interview-types";
import { getDb } from "@/server/db/client";
import { aiRuns, interviewRuntimeConfigs, interviewTurnBasedTurns, sessions } from "@/server/db/schema";

export type InterviewInspectionAiRun = {
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  estimatedCostMicroUsd?: number;
  id: string;
  inputAudioTokens?: number;
  inputTokens?: number;
  model: string;
  outputAudioTokens?: number;
  outputTokens?: number;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  promptSnapshot?: string;
  providerRequestId?: string;
  rawJson?: Record<string, unknown>;
  runType: string;
  startedAt: string;
  status: string;
  totalTokens?: number;
};

export type InterviewInspectionRun = {
  aiRuns: InterviewInspectionAiRun[];
  contextSnapshot: SessionSetupSnapshot;
  createdAt: string;
  endedAt?: string;
  engine: "realtime" | "turn_based";
  evaluationError?: string;
  evaluationStatus: string;
  id: string;
  modeKey: string;
  questionTypeKey?: string;
  runtime: {
    maxAnswerSeconds?: number;
    maxDurationSeconds?: number;
    maxTurns?: number;
    model?: string;
    promptConfigKey?: string;
    promptConfigVersion?: number;
    voice?: string;
  };
  startedAt?: string;
  status: string;
  styleKey: string;
  transcript: VoiceTranscriptTurn[];
  turns: Array<{
    answerTranscript?: string;
    createdAt: string;
    feedback?: string;
    id: string;
    question: string;
    routingReason: string;
    status: string;
    targetSkill: string;
    turnIndex: number;
  }>;
};

function optionalIso(value: Date | null) {
  return value?.toISOString();
}

export async function listInterviewInspectionRuns(limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const db = getDb();
  const sessionRows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .limit(safeLimit);

  if (sessionRows.length === 0) {
    return [] satisfies InterviewInspectionRun[];
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const [turnRows, aiRunRows, runtimeRows] = await Promise.all([
    db
      .select()
      .from(interviewTurnBasedTurns)
      .where(inArray(interviewTurnBasedTurns.sessionId, sessionIds))
      .orderBy(asc(interviewTurnBasedTurns.turnIndex)),
    db
      .select()
      .from(aiRuns)
      .where(inArray(aiRuns.sessionId, sessionIds))
      .orderBy(asc(aiRuns.startedAt)),
    db.select().from(interviewRuntimeConfigs),
  ]);

  const turnsBySession = new Map<string, typeof turnRows>();
  for (const turn of turnRows) {
    const rows = turnsBySession.get(turn.sessionId) ?? [];
    rows.push(turn);
    turnsBySession.set(turn.sessionId, rows);
  }

  const aiRunsBySession = new Map<string, typeof aiRunRows>();
  for (const aiRun of aiRunRows) {
    if (!aiRun.sessionId) continue;
    const rows = aiRunsBySession.get(aiRun.sessionId) ?? [];
    rows.push(aiRun);
    aiRunsBySession.set(aiRun.sessionId, rows);
  }

  const runtimeByMode = new Map(runtimeRows.map((runtime) => [runtime.modeKey, runtime]));

  return sessionRows.map((session): InterviewInspectionRun => {
    const artifact = session.voiceArtifact as VoiceSessionArtifactDraft | null;
    const runtime = runtimeByMode.get(session.modeKey);

    return {
      aiRuns: (aiRunsBySession.get(session.id) ?? []).map((aiRun) => ({
        completedAt: optionalIso(aiRun.completedAt),
        durationMs: aiRun.durationMs ?? undefined,
        errorMessage: aiRun.errorMessage ?? undefined,
        estimatedCostMicroUsd: aiRun.estimatedCostMicroUsd ?? undefined,
        id: aiRun.id,
        inputAudioTokens: aiRun.inputAudioTokens ?? undefined,
        inputTokens: aiRun.inputTokens ?? undefined,
        model: aiRun.model,
        outputAudioTokens: aiRun.outputAudioTokens ?? undefined,
        outputTokens: aiRun.outputTokens ?? undefined,
        promptConfigKey: aiRun.promptConfigKey ?? undefined,
        promptConfigVersion: aiRun.promptConfigVersion ?? undefined,
        promptSnapshot: aiRun.promptSnapshot ?? undefined,
        providerRequestId: aiRun.providerRequestId ?? undefined,
        rawJson: aiRun.rawJson ?? undefined,
        runType: aiRun.runType,
        startedAt: aiRun.startedAt.toISOString(),
        status: aiRun.status,
        totalTokens: aiRun.totalTokens ?? undefined,
      })),
      contextSnapshot: session.contextSnapshot,
      createdAt: session.createdAt.toISOString(),
      endedAt: optionalIso(session.endedAt),
      engine: runtime?.engine ?? (session.realtimeModel ? "realtime" : "turn_based"),
      evaluationError: session.evaluationError ?? undefined,
      evaluationStatus: session.evaluationStatus,
      id: session.id,
      modeKey: session.modeKey,
      questionTypeKey: session.questionTypeKey ?? undefined,
      runtime: {
        maxAnswerSeconds: runtime?.maxAnswerSeconds,
        maxDurationSeconds: runtime?.maxDurationSeconds,
        maxTurns: runtime?.maxTurns,
        model: session.realtimeModel ?? runtime?.textModel,
        promptConfigKey: session.realtimePromptConfigKey ?? undefined,
        promptConfigVersion: session.realtimePromptConfigVersion ?? undefined,
        voice: session.realtimeVoice ?? runtime?.ttsVoice,
      },
      startedAt: optionalIso(session.startedAt),
      status: session.status,
      styleKey: session.styleKey,
      transcript: artifact?.transcript ?? [],
      turns: (turnsBySession.get(session.id) ?? []).map((turn) => ({
        answerTranscript: turn.answerTranscript ?? undefined,
        createdAt: turn.createdAt.toISOString(),
        feedback: turn.feedback ?? undefined,
        id: turn.id,
        question: turn.question,
        routingReason: turn.routingReason,
        status: turn.status,
        targetSkill: turn.targetSkill,
        turnIndex: turn.turnIndex,
      })),
    };
  });
}

function csvCell(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function interviewInspectionRunsToCsv(runs: InterviewInspectionRun[]) {
  const headers = [
    "run_id",
    "started_at",
    "mode",
    "engine",
    "session_status",
    "evaluation_status",
    "question_type",
    "style",
    "target_role",
    "target_company",
    "turn_index",
    "speaker",
    "generated_question",
    "user_response",
    "que_feedback",
    "routing_reason",
    "target_skill",
    "ai_run_type",
    "model",
    "prompt_config",
    "prompt_version",
    "ai_status",
    "duration_ms",
    "input_tokens",
    "output_tokens",
    "estimated_cost_micro_usd",
  ];
  const rows: unknown[][] = [];

  for (const run of runs) {
    const base = [
      run.id,
      run.startedAt ?? run.createdAt,
      run.modeKey,
      run.engine,
      run.status,
      run.evaluationStatus,
      run.questionTypeKey,
      run.styleKey,
      run.contextSnapshot.interviewContext.targetRole,
      run.contextSnapshot.interviewContext.targetCompany,
    ];
    const relevantAiRuns = run.aiRuns.filter((aiRun) =>
      ["interview_turn", "realtime"].includes(aiRun.runType),
    );

    if (run.turns.length > 0) {
      for (const turn of run.turns) {
        const aiRun = relevantAiRuns.find(
          (candidate) => candidate.rawJson?.turnIndex === turn.turnIndex,
        );
        rows.push([
          ...base,
          turn.turnIndex,
          "Que / You",
          turn.question,
          turn.answerTranscript,
          turn.feedback,
          turn.routingReason,
          turn.targetSkill,
          aiRun?.runType,
          aiRun?.model ?? run.runtime.model,
          aiRun?.promptConfigKey ?? run.runtime.promptConfigKey,
          aiRun?.promptConfigVersion ?? run.runtime.promptConfigVersion,
          aiRun?.status,
          aiRun?.durationMs,
          aiRun?.inputTokens,
          aiRun?.outputTokens,
          aiRun?.estimatedCostMicroUsd,
        ]);
      }
      continue;
    }

    if (run.transcript.length > 0) {
      for (const [index, transcriptTurn] of run.transcript.entries()) {
        const aiRun = relevantAiRuns[0];
        rows.push([
          ...base,
          index + 1,
          transcriptTurn.speaker,
          transcriptTurn.role === "assistant" ? transcriptTurn.text : undefined,
          transcriptTurn.role === "user" ? transcriptTurn.text : undefined,
          undefined,
          undefined,
          undefined,
          aiRun?.runType,
          aiRun?.model ?? run.runtime.model,
          aiRun?.promptConfigKey ?? run.runtime.promptConfigKey,
          aiRun?.promptConfigVersion ?? run.runtime.promptConfigVersion,
          aiRun?.status,
          aiRun?.durationMs,
          aiRun?.inputTokens,
          aiRun?.outputTokens,
          aiRun?.estimatedCostMicroUsd,
        ]);
      }
      continue;
    }

    const aiRun = relevantAiRuns[0];
    rows.push([
      ...base,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      aiRun?.runType,
      aiRun?.model ?? run.runtime.model,
      aiRun?.promptConfigKey ?? run.runtime.promptConfigKey,
      aiRun?.promptConfigVersion ?? run.runtime.promptConfigVersion,
      aiRun?.status,
      aiRun?.durationMs,
      aiRun?.inputTokens,
      aiRun?.outputTokens,
      aiRun?.estimatedCostMicroUsd,
    ]);
  }

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
