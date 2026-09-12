import type { SessionSetupSnapshot } from "@/product/interview-types";
import type {
  RealtimeModelLabPromptVariant,
  RealtimeModelLabTurnExpectation,
} from "@/server/interview/realtime-model-lab";

export type RealtimeModelLabScriptedTurn = {
  expectation: RealtimeModelLabTurnExpectation;
  objective: string;
  objectiveInstruction: string;
  strictTemplateAllowsAdaptation?: boolean;
  strictResponseTemplate?: string;
  userText: string;
};

export type RealtimeModelLabScenario = {
  key: string;
  modeLabel: string;
  snapshot: SessionSetupSnapshot;
  turns: RealtimeModelLabScriptedTurn[];
  version: number;
};

export const realtimeModelLabPromptVariants = [
  "native_mock_v1",
  "production_v1",
  "mini_compact_v1",
  "mini_compact_state_v1",
  "mini_compact_state_v2",
] as const satisfies readonly RealtimeModelLabPromptVariant[];

const aviationContext = {
  jobDescription:
    "A flight operations role requiring sound judgment, calm communication, checklist discipline, customer care, and effective crew coordination.",
  preferredName: "Model Lab Candidate",
  targetCompany: "QuesIQ Test Airline",
  targetRole: "Flight Operations Pilot",
};

export const realtimeModelLabScenarios: Record<string, RealtimeModelLabScenario> = {
  first_impression_v1: {
    key: "first_impression_v1",
    modeLabel: "First Impression",
    snapshot: {
      interviewContext: aviationContext,
      modeKey: "first_impression",
      questionTypeKey: "motivational",
      styleKey: "friendly",
    },
    turns: [
      {
        expectation: {
          maxQuestions: 1,
          maxWords: 45,
          minQuestions: 1,
          requiredAnyPatterns: [
            "tell me about yourself",
            "walk me through (?:your )?background",
            "introduce yourself",
          ],
        },
        objective: "opening_question",
        objectiveInstruction:
          "Ask one natural Tell me about yourself style opening question. Do not coach yet.",
        strictResponseTemplate:
          "Tell me about yourself as it relates to this Flight Operations Pilot role.",
        userText: "Start First Impression practice now.",
      },
      {
        expectation: {
          maxQuestions: 1,
          maxWords: 75,
          minQuestions: 0,
          requiredAllPatterns: [
            "retry|try again|another attempt|say it again|give it another",
            "clear|specific|role|opening|concise|connect|strength",
          ],
        },
        objective: "one_coaching_point_and_retry",
        objectiveInstruction:
          "Give exactly one concise coaching point tied to the answer, then invite one retry. Do not ask a new interview question.",
        userText:
          "I am a professional pilot with experience operating in changing conditions. I value preparation, clear communication, and helping the crew stay aligned, and I am ready to bring that discipline to this role.",
      },
      {
        expectation: {
          forbiddenPatterns: ["coaching point|next time|retry|try again"],
          maxQuestions: 0,
          maxWords: 48,
          minQuestions: 0,
          requiredAnyPatterns: ["clear|specific|strong|improved|better|role|opening"],
        },
        objective: "close_after_retry",
        objectiveInstruction:
          "In no more than two short sentences, acknowledge one specific improvement and close the First Impression exercise. Give no additional coaching or advice, offer no retry, and ask no question.",
        strictResponseTemplate:
          "Name one specific improvement in one short sentence, then say: This First Impression exercise is complete.",
        strictTemplateAllowsAdaptation: true,
        userText:
          "I am a professional pilot known for calm preparation and clear crew communication. During a recent weather diversion, I coordinated the revised plan without a procedural deviation, and I want to bring that disciplined judgment to this flight operations role.",
      },
    ],
    version: 1,
  },
  coaching_v1: {
    key: "coaching_v1",
    modeLabel: "Coaching",
    snapshot: {
      interviewContext: aviationContext,
      modeKey: "coaching",
      questionTypeKey: "behavioral",
      styleKey: "friendly",
    },
    turns: [
      {
        expectation: {
          forbiddenPatterns: ["feedback|coach|improve|try again"],
          maxQuestions: 1,
          maxWords: 34,
          minQuestions: 1,
        },
        objective: "opening_question",
        objectiveInstruction:
          "Ask one concise behavioral interview question. Do not give coaching before the candidate answers.",
        strictResponseTemplate: "Tell me about a time you resolved a team disagreement.",
        userText: "Start Coaching practice with one teamwork question.",
      },
      {
        expectation: {
          allowMenuQuestion: true,
          maxQuestions: 1,
          maxWords: 80,
          minQuestions: 0,
          requiredAllPatterns: [
            "specific|result|action|impact|clear|concise|focus|detail",
            "retry|try again|more feedback|ask que|move on",
          ],
        },
        objective: "one_coaching_point_and_choice",
        objectiveInstruction:
          "Give exactly one concrete coaching point about the latest answer. Then ask whether the candidate wants to retry, get more feedback, ask Que, or move on. Do not ask a new interview question.",
        userText:
          "We had a disagreement about how to manage a delay. I talked with the other crewmember and we worked it out.",
      },
      {
        expectation: {
          forbiddenPatterns: ["coaching point|improve|add one|outcome"],
          maxQuestions: 1,
          maxWords: 42,
          minQuestions: 0,
          requiredAnyPatterns: [
            "try again|retry|answer again|give (?:that|it) another|give .* another try|another try|tell me about a time you resolved a team disagreement",
          ],
        },
        objective: "retry_same_question",
        objectiveInstruction:
          "The candidate chose Try again. Briefly invite a retry of the same teamwork answer. Do not coach and do not introduce a different scenario.",
        strictResponseTemplate: "Please give that same teamwork answer another try.",
        userText: "I would like to try that answer again.",
      },
      {
        expectation: {
          allowMenuQuestion: true,
          maxQuestions: 1,
          maxWords: 80,
          minQuestions: 0,
          requiredAllPatterns: [
            "specific|result|action|impact|clear|concise|strong|improv",
            "retry|try again|more feedback|ask que|move on",
          ],
        },
        objective: "one_coaching_point_and_choice",
        objectiveInstruction:
          "Name exactly one improvement in the retry, then ask whether the candidate wants to retry, get more feedback, ask Que, or move on. Do not ask a new interview question.",
        userText:
          "When a maintenance delay created disagreement, I restated the shared safety priority, asked the first officer for the operational concern behind his position, and coordinated a revised departure plan with maintenance. We departed with both crewmembers aligned and no checklist steps missed.",
      },
    ],
    version: 1,
  },
  rapid_fire_v1: {
    key: "rapid_fire_v1",
    modeLabel: "Rapid Fire",
    snapshot: {
      interviewContext: aviationContext,
      modeKey: "rapid_fire",
      questionTypeKey: "behavioral",
      styleKey: "neutral",
    },
    turns: [
      {
        expectation: {
          forbiddenPatterns: ["feedback|coach|improve|try again"],
          maxQuestions: 1,
          maxWords: 24,
          minQuestions: 1,
        },
        objective: "opening_question",
        objectiveInstruction:
          "Ask one short behavioral interview question. Do not explain the mode or give coaching.",
        strictResponseTemplate: "Tell me about a time you adapted quickly to an unexpected change.",
        userText: "Start Rapid Fire practice now.",
      },
      {
        expectation: {
          forbiddenPatterns: [
            "feedback|coach|improve|try again|strong answer|good answer|clear example",
            "diversion|dispatch|passenger|alternate|brief|weather|workload|that (?:answer|example|situation)",
          ],
          maxQuestions: 1,
          maxWords: 30,
          minQuestions: 1,
        },
        objective: "fresh_question_no_coaching",
        objectiveInstruction:
          "Acknowledge in at most four words, then ask exactly one fresh question about teamwork. Do not mention or continue the diversion, briefing, dispatch, passengers, alternate, weather, plan, or any previous action. Do not add a second detail question.",
        strictResponseTemplate:
          "Brief acknowledgment. Then ask only: Tell me about a time you helped a teammate succeed.",
        userText:
          "During a diversion, I briefed the crew, coordinated with dispatch, and updated the passengers before we landed safely at the alternate.",
      },
      {
        expectation: {
          forbiddenPatterns: [
            "feedback|coach|improve|try again|strong answer|good answer|clear example",
            "team|crew|disagreement",
          ],
          maxQuestions: 1,
          maxWords: 30,
          minQuestions: 1,
        },
        objective: "fresh_question_no_coaching",
        objectiveInstruction:
          "Acknowledge in at most four words, then ask exactly one fresh question about customer service. Do not follow up on the teamwork answer and do not add a second detail question.",
        strictResponseTemplate:
          "Brief acknowledgment. Then ask only: Tell me about a time you resolved a customer concern.",
        userText:
          "I helped resolve a crew disagreement by clarifying the shared objective and inviting each person to state the main operational concern.",
      },
      {
        expectation: {
          maxQuestions: 0,
          maxWords: 24,
          minQuestions: 0,
        },
        objective: "pause_without_question",
        objectiveInstruction:
          "The candidate asked to pause. Briefly acknowledge the pause. Ask no question and provide no coaching.",
        strictResponseTemplate: "Paused. Say continue whenever you are ready.",
        userText: "Pause for a moment, please.",
      },
    ],
    version: 1,
  },
  mock_behavioral_v1: {
    key: "mock_behavioral_v1",
    modeLabel: "Mock Interview",
    snapshot: {
      interviewContext: aviationContext,
      modeKey: "mock_interview",
      questionTypeKey: "behavioral",
      styleKey: "neutral",
    },
    turns: [
      {
        expectation: { maxQuestions: 1, maxWords: 36, minQuestions: 1 },
        objective: "opening_question",
        objectiveInstruction: "Ask one concise behavioral interview question.",
        userText: "Begin the mock interview now by asking one concise behavioral question.",
      },
      {
        expectation: { maxQuestions: 1, maxWords: 38, minQuestions: 1 },
        objective: "one_follow_up",
        objectiveInstruction:
          "Ask for one missing detail from the latest answer. Do not ask a new scenario yet.",
        userText:
          "During a weather diversion, I gathered the updated conditions, briefed the crew, coordinated with dispatch, and clearly explained the revised plan to the passengers. We landed safely at the alternate with the team aligned and no procedural deviations.",
      },
      {
        expectation: { maxQuestions: 1, maxWords: 38, minQuestions: 1 },
        objective: "fresh_question",
        objectiveInstruction:
          "Move to one fresh behavioral interview question. Do not coach or evaluate.",
        userText: "Please continue the interview with the next appropriate question.",
      },
    ],
    version: 2,
  },
};

export const lighterRealtimeModelLabScenarioKeys = [
  "first_impression_v1",
  "coaching_v1",
  "rapid_fire_v1",
] as const;

export function isRealtimeModelLabPromptVariant(
  value: string,
): value is RealtimeModelLabPromptVariant {
  return realtimeModelLabPromptVariants.includes(value as RealtimeModelLabPromptVariant);
}

export function buildMiniCompactInstructions(
  scenario: RealtimeModelLabScenario,
): string {
  const { snapshot } = scenario;
  const role = snapshot.interviewContext.targetRole || "the candidate's target role";
  const company = snapshot.interviewContext.targetCompany || "the target company";
  const focus = snapshot.questionTypeKey || "role-relevant";
  const style = snapshot.styleKey || "neutral";
  const modeContracts: Record<string, string[]> = {
    coaching: [
      "COACHING MODE: Use the loop question, answer, one coaching point, candidate choice.",
      "Never combine coaching with a new interview question.",
      "A coaching point identifies one improvement only and stays grounded in the candidate's words.",
    ],
    first_impression: [
      "FIRST IMPRESSION MODE: Practice only the candidate's opening introduction.",
      "Open with one Tell me about yourself style question.",
      "After the answer, give one coaching point and invite one retry. After the retry, close the exercise.",
    ],
    rapid_fire: [
      "RAPID FIRE MODE: Ask short, fresh questions with brisk transitions.",
      "Never coach, score, critique, retry, or follow up on the previous answer between questions.",
      "If the candidate asks to pause, acknowledge the pause and ask nothing.",
    ],
  };

  return [
    "You are Que, a professional interview-practice partner.",
    "Speak only clear American English. Sound natural, direct, and supportive without sounding scripted.",
    ...(modeContracts[snapshot.modeKey || ""] || [
      "MOCK INTERVIEW MODE: Behave like an interviewer and save coaching for the review.",
    ]),
    "Each spoken turn has one conversational objective. Ask no more than one question and request no more than one answer target.",
    "Keep turns brief. Use plain spoken sentences with no headings, bullets, labels, or meta-commentary.",
    `Context: ${role} at ${company}. Question focus: ${focus}. Tone: ${style}.`,
    "Good single-target question: What was the first action you personally took?",
    "Good natural behavioral question: Tell me about a time you resolved a team disagreement.",
    "Overloaded question to avoid: What happened, how did you respond, and what was the result?",
  ].join("\n");
}

export function instructionsForLabTurn(
  baseInstructions: string,
  variant: RealtimeModelLabPromptVariant,
  turn: RealtimeModelLabScriptedTurn,
) {
  if (variant !== "mini_compact_state_v1" && variant !== "mini_compact_state_v2") {
    return baseInstructions;
  }

  const currentTurnControl =
    variant === "mini_compact_state_v2" && turn.strictResponseTemplate
      ? [
          "STRICT RESPONSE TEMPLATE:",
          turn.strictResponseTemplate,
          turn.strictTemplateAllowsAdaptation
            ? "Follow the template in no more than two sentences. The improvement must be grounded in the candidate's latest answer."
            : "Say exactly and only the template. Do not add coaching, setup, explanation, a second question, or another turn.",
        ].join("\n")
      : turn.objectiveInstruction;

  return [
    baseInstructions,
    "CURRENT TURN CONTROL:",
    currentTurnControl,
    "Follow the current-turn control even if earlier conversation suggests another action.",
  ].join("\n");
}
