import assert from "node:assert/strict";
import test from "node:test";

import {
  addRealtimeUsage,
  assessRealtimeModelLabTurn,
  estimateRealtimeModelLabCostMicroUsd,
  isRealtimeModelLabModel,
  normalizeRealtimeUsage,
} from "./realtime-model-lab";
import {
  buildMiniCompactInstructions,
  instructionsForLabTurn,
  realtimeModelLabScenarios,
} from "./realtime-model-lab-scenarios";

test("Realtime model lab accepts only the bounded comparison models", () => {
  assert.equal(isRealtimeModelLabModel("gpt-realtime-2.1"), true);
  assert.equal(isRealtimeModelLabModel("gpt-realtime-2.1-mini"), true);
  assert.equal(isRealtimeModelLabModel("gpt-realtime"), false);
  assert.equal(isRealtimeModelLabModel("gpt-5.4"), true);
  assert.equal(isRealtimeModelLabModel("gpt-5.4-mini"), true);
  assert.equal(isRealtimeModelLabModel("arbitrary-model"), false);
});

test("prompt-contract assessment catches compound questions with one question mark", () => {
  assert.equal(
    assessRealtimeModelLabTurn(
      "What was the specific change you made, and what did you say to dispatch?",
    ).noCompoundQuestion,
    false,
  );
  assert.equal(
    assessRealtimeModelLabTurn("What was the one action you personally took?").passed,
    true,
  );
  assert.equal(
    assessRealtimeModelLabTurn(
      "Was it a briefing, a checklist, or a communication protocol you followed?",
    ).noCompoundQuestion,
    false,
  );
});

test("prompt-contract assessment allows a natural single behavioral target", () => {
  const assessment = assessRealtimeModelLabTurn(
    "Tell me about a time you resolved a team disagreement and what you personally did?",
    { maxQuestions: 1, minQuestions: 1 },
  );

  assert.equal(assessment.noCompoundQuestion, true);
  assert.equal(assessment.passed, true);
});

test("semantic question count catches two spoken prompts and ignores declarative coaching", () => {
  const twoPrompts = assessRealtimeModelLabTurn(
    "Tell me about a team disagreement. What was the first action you took?",
    { maxQuestions: 1, minQuestions: 1 },
  );
  const coachingStatement = assessRealtimeModelLabTurn(
    "One coaching point: explain what changed and how your action helped the crew.",
    { maxQuestions: 0, minQuestions: 0 },
  );

  assert.equal(twoPrompts.questionCountValid, false);
  assert.equal(coachingStatement.noCompoundQuestion, true);
  assert.equal(coachingStatement.questionCountValid, true);
});

test("mode expectations detect missing turn behavior and excessive length", () => {
  const assessment = assessRealtimeModelLabTurn(
    "That was a good answer. Here is detailed feedback about several areas you can improve before we continue with another new question.",
    {
      forbiddenPatterns: ["feedback|improve"],
      maxQuestions: 0,
      maxWords: 10,
    },
  );

  assert.equal(assessment.concise, false);
  assert.equal(assessment.modeFidelity, false);
  assert.deepEqual(assessment.failureReasons.sort(), ["mode_fidelity", "too_long"]);
});

test("compact Mini prompt is mode-specific and state variant adds current-turn control", () => {
  const scenario = realtimeModelLabScenarios.rapid_fire_v1;
  const compact = buildMiniCompactInstructions(scenario);
  const stateControlled = instructionsForLabTurn(
    compact,
    "mini_compact_state_v1",
    scenario.turns[1],
  );

  assert.match(compact, /RAPID FIRE MODE/);
  assert.doesNotMatch(compact, /COACHING MODE/);
  assert.match(stateControlled, /CURRENT TURN CONTROL/);
  assert.match(stateControlled, /fresh question about teamwork/i);
  assert.equal(
    instructionsForLabTurn(compact, "mini_compact_v1", scenario.turns[1]),
    compact,
  );
  const strictStateControlled = instructionsForLabTurn(
    compact,
    "mini_compact_state_v2",
    scenario.turns[1],
  );
  assert.match(strictStateControlled, /STRICT RESPONSE TEMPLATE/);
  assert.match(strictStateControlled, /helped a teammate succeed/i);
});

test("Realtime usage normalization preserves modality token details", () => {
  assert.deepEqual(
    normalizeRealtimeUsage({
      input_token_details: { audio_tokens: 10, cached_tokens: 20, text_tokens: 90 },
      input_tokens: 100,
      output_token_details: { audio_tokens: 30, text_tokens: 5 },
      output_tokens: 35,
      total_tokens: 135,
    }),
    {
      cachedInputTokens: 20,
      inputAudioTokens: 10,
      inputTextTokens: 90,
      inputTokens: 100,
      outputAudioTokens: 30,
      outputTextTokens: 5,
      outputTokens: 35,
      totalTokens: 135,
    },
  );
});

test("Realtime usage totals and model-specific costs are deterministic", () => {
  const first = normalizeRealtimeUsage({ input_tokens: 100, output_tokens: 20 });
  const second = normalizeRealtimeUsage({ input_tokens: 200, output_tokens: 30 });
  const total = addRealtimeUsage(first, second);

  assert.equal(total.inputTextTokens, 300);
  assert.equal(total.outputTextTokens, 50);
  assert.equal(total.totalTokens, 350);
  assert.equal(estimateRealtimeModelLabCostMicroUsd("gpt-realtime-2.1", total), 2400);
  assert.equal(estimateRealtimeModelLabCostMicroUsd("gpt-realtime-2.1-mini", total), 300);
});
