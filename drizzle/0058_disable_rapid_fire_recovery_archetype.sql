UPDATE "interview_question_archetypes"
SET
  "enabled" = false,
  "updated_at" = now()
WHERE
  "mode_key" = 'rapid_fire'
  AND "title" = 'Vague answer recovery';

UPDATE "practice_modes"
SET
  "prompt_instructions" = 'Run this as a paced repetition drill for composure and quick recall. Ask short, realistic interview questions one at a time. Keep transitions brisk and move to a fresh, unrelated question after each answer. Do not coach between answers, do not ask recovery follow-ups, do not reference the previous answer unless the user explicitly asks to pause, and save deeper coaching for the post-session review. Favor variety within the selected question focus. Do not ask multi-part questions, and do not let the session become a long coaching conversation.',
  "updated_at" = now()
WHERE "key" = 'rapid_fire';
