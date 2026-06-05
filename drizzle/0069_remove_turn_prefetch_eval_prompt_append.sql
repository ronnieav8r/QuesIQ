UPDATE "prompt_configs"
SET
  "instructions" = replace(
    "instructions",
    E'\nIf turn archetype metadata is provided, return archetypePerformance entries summarizing performance by archetype using only transcript-backed evidence. If no archetype metadata is available, return an empty archetypePerformance array.',
    ''
  ),
  "updated_at" = now()
WHERE "key" = 'session_evaluation'
  AND "instructions" ILIKE '%If turn archetype metadata is provided, return archetypePerformance entries%';
