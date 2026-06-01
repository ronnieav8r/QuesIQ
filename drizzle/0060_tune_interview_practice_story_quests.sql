DO $$
BEGIN
  IF to_regclass('public.progression_quests') IS NULL THEN
    RETURN;
  END IF;

  UPDATE "progression_quests"
  SET
    "title" = 'Coaching Loop',
    "description" = 'Complete a Coaching practice session with in-session feedback rounds.',
    "updated_at" = now()
  WHERE "key" = 'coaching_mode';

  UPDATE "progression_quests"
  SET
    "title" = 'Paced Reps',
    "description" = 'Complete a Rapid Fire practice session with paced question reps.',
    "updated_at" = now()
  WHERE "key" = 'rapid_fire_mode';

  UPDATE "progression_quests"
  SET
    "title" = 'Mock Interview Complete',
    "description" = 'Complete a full Mock Interview practice session.',
    "xp_reward" = 75,
    "updated_at" = now()
  WHERE "key" = 'mock_interview_mode';

  UPDATE "progression_quests"
  SET
    "title" = 'Practice Trifecta',
    "description" = 'Complete Coaching, Rapid Fire, and Mock Interview practice modes.',
    "check_threshold" = 3,
    "updated_at" = now()
  WHERE "key" = 'all_modes';

  UPDATE "progression_quests"
  SET
    "title" = 'Intro Ready',
    "description" = 'Save your first interview introduction in Story Lab.',
    "updated_at" = now()
  WHERE "key" = 'first_introduction_saved';

  UPDATE "progression_quests"
  SET
    "title" = 'Story Lab Started',
    "description" = 'Save your first TMAAT story in Story Lab.',
    "updated_at" = now()
  WHERE "key" = 'first_story_saved';

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
  ) VALUES (
    'story_bank_3',
    'Story Bank Builder',
    'Save three TMAAT stories in Story Lab.',
    'story_lab',
    'story_count',
    NULL,
    3,
    100,
    144,
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

  UPDATE "progression_quests"
  SET
    "enabled" = false,
    "updated_at" = now()
  WHERE "key" = 'first_impression_mode';
END $$;
