CREATE TABLE "progression_level_thresholds" (
	"level" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_total_xp" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "progression_level_thresholds" ("level", "name", "min_total_xp") VALUES
	(1, 'Level 1', 0),
	(2, 'Level 2', 300),
	(3, 'Level 3', 600),
	(4, 'Level 4', 900),
	(5, 'Level 5', 1200),
	(6, 'Level 6', 1500),
	(7, 'Level 7', 1800),
	(8, 'Level 8', 2100),
	(9, 'Level 9', 2400),
	(10, 'Level 10', 2700);
