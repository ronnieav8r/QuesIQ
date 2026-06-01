DO $$
BEGIN
  IF to_regclass('public.practice_modes') IS NOT NULL THEN
    UPDATE "practice_modes"
    SET "enabled" = false,
        "updated_at" = now()
    WHERE "key" = 'first_impression';
  END IF;

  IF to_regclass('public.progression_quests') IS NOT NULL THEN
    UPDATE "progression_quests"
    SET "enabled" = false,
        "updated_at" = now()
    WHERE "key" = 'first_impression_mode';
  END IF;
END $$;
