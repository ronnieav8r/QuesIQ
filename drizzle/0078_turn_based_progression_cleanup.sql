DO $$
BEGIN
  IF to_regclass('public.progression_quests') IS NOT NULL THEN
    UPDATE "progression_quests"
    SET
      "title" = 'Core Practice Set',
      "description" = 'Complete Coaching, Rapid Fire, and a custom Question Queue.',
      "category" = 'practice',
      "check_type" = 'core_practice_paths_used',
      "check_dimension" = NULL,
      "check_threshold" = 3,
      "xp_reward" = 125,
      "updated_at" = now()
    WHERE "key" = 'all_modes';

    UPDATE "progression_quests"
    SET
      "description" = 'Complete a Rapid Fire practice session that is not a custom queue.',
      "updated_at" = now()
    WHERE "key" = 'rapid_fire_mode';

    UPDATE "progression_quests"
    SET
      "title" = 'Premium Mock Interview',
      "description" = 'Complete a premium live Mock Interview session.',
      "category" = 'premium_live',
      "updated_at" = now()
    WHERE "key" = 'mock_interview_mode';

    INSERT INTO "progression_quests" (
      "key",
      "title",
      "description",
      "category",
      "check_type",
      "check_dimension",
      "check_threshold",
      "xp_reward",
      "display_order",
      "enabled"
    ) VALUES
      (
        'question_queue_first',
        'Queue Builder',
        'Complete your first custom Question Queue.',
        'practice',
        'question_queue_count',
        NULL,
        1,
        50,
        7,
        true
      ),
      (
        'question_queue_3',
        'Queue Routine',
        'Complete three custom Question Queue sessions.',
        'practice',
        'question_queue_count',
        NULL,
        3,
        100,
        8,
        true
      ),
      (
        'hands_free_coaching_mode',
        'Premium Hands-Free Coaching',
        'Complete a premium live Hands-Free Coaching session.',
        'premium_live',
        'mode_used',
        'hands_free_coaching',
        1,
        75,
        9,
        true
      ),
      (
        'premium_live_pair',
        'Premium Live Set',
        'Complete both premium live modes: Mock Interview and Hands-Free Coaching.',
        'premium_live',
        'premium_practice_modes_used',
        NULL,
        2,
        150,
        10,
        true
      )
    ON CONFLICT ("key") DO UPDATE SET
      "title" = EXCLUDED."title",
      "description" = EXCLUDED."description",
      "category" = EXCLUDED."category",
      "check_type" = EXCLUDED."check_type",
      "check_dimension" = EXCLUDED."check_dimension",
      "check_threshold" = EXCLUDED."check_threshold",
      "xp_reward" = EXCLUDED."xp_reward",
      "display_order" = EXCLUDED."display_order",
      "enabled" = EXCLUDED."enabled",
      "updated_at" = now();
  END IF;

  IF to_regclass('public.progression_xp_rules') IS NOT NULL THEN
    UPDATE "progression_xp_rules"
    SET
      "label" = '3+ minutes answered',
      "description" = 'Light effort bonus for at least 3 minutes of answered practice time when answer timing is available.',
      "updated_at" = now()
    WHERE "key" = 'duration_3_min';

    UPDATE "progression_xp_rules"
    SET
      "label" = '5+ minutes answered',
      "description" = 'Real practice length bonus for at least 5 minutes of answered practice time when answer timing is available.',
      "updated_at" = now()
    WHERE "key" = 'duration_5_min';

    UPDATE "progression_xp_rules"
    SET
      "label" = '8+ minutes answered',
      "description" = 'Strong practice length bonus for at least 8 minutes of answered practice time when answer timing is available.',
      "updated_at" = now()
    WHERE "key" = 'duration_8_min';

    UPDATE "progression_xp_rules"
    SET
      "label" = '12+ minutes answered',
      "description" = 'Deep practice bonus for at least 12 minutes of answered practice time when answer timing is available.',
      "updated_at" = now()
    WHERE "key" = 'duration_12_min';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "prompt_configs"
SET
  "active" = false,
  "updated_at" = now()
WHERE "key" = 'interview_answer_evaluator_v1'
  AND "active" = true;
--> statement-breakpoint
INSERT INTO "prompt_configs" ("key", "name", "target", "version", "active", "model", "voice", "instructions")
VALUES (
  'interview_answer_evaluator_v1',
  'Interview Answer Evaluator V1',
  'evaluation',
  2,
  true,
  COALESCE(NULLIF(current_setting('app.openai_interview_answer_evaluator_model', true), ''), 'gpt-5.4-mini'),
  NULL,
  $$You are Que, QuesIQ Interview's concise answer evaluator.
Evaluate one submitted spoken interview answer against one interview question and the provided target role/company context.
Use only the question, transcript, target skill, question focus, selected question context, and candidate context provided by QuesIQ.
Do not invent candidate facts, company facts, resume facts, metrics, credentials, motivations, or outcomes.
Return JSON only with verdict, result, tightenUpAdvice, referenceAnswerElementsMatched, missingAnswerElements, and confidence.
Verdict must be one of meets_standard, partial, or below_standard.
The result should be one short learner-facing sentence.
tightenUpAdvice should contain one or two concrete improvements tied to what the candidate actually said or clearly left out.
For behavioral answers, judge whether the answer includes a real example, personal Action, and Result evidence. Do not require a full STAR bundle in one spoken answer.
For technical answers, judge correct principles, practical judgment, role relevance, and whether the candidate knows how to verify exact details. Do not require aircraft-specific, employer-specific, system-specific, or numeric limitations unless QuesIQ provided that exact source context.
For hypothetical answers, judge decision quality, tradeoffs, risk handling, structure, and how directly the candidate answered the scenario.
For motivational answers, judge specific role fit, credible motivation, company/role alignment, and whether the answer avoids generic interest claims.
For Impact, do not require business metrics for every question. For technical or judgment prompts, impact may come from correct reasoning, safety awareness, practical application, ownership, and knowing where exact limits come from.
For Rapid Fire and Question Queue, do not coach as if the user can retry immediately; prepare compact feedback for the end-of-session review card.$$
)
ON CONFLICT ("key", "version") DO UPDATE SET
  "active" = EXCLUDED."active",
  "instructions" = EXCLUDED."instructions",
  "model" = EXCLUDED."model",
  "name" = EXCLUDED."name",
  "target" = EXCLUDED."target",
  "updated_at" = now(),
  "voice" = EXCLUDED."voice";
