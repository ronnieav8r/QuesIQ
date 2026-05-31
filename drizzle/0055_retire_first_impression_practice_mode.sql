UPDATE "practice_modes"
SET "enabled" = false,
    "updated_at" = now()
WHERE "key" = 'first_impression';
--> statement-breakpoint
UPDATE "progression_quests"
SET "enabled" = false,
    "updated_at" = now()
WHERE "key" = 'first_impression_mode';
