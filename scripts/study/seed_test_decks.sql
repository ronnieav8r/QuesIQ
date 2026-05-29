-- Small Study library test seed.
-- All generated records are marked so they can be deleted:
--   title starts with [TEST_DELETE]
--   tags include __test_delete__

BEGIN;

INSERT INTO study_subjects (name, slug)
VALUES ('Test Basics', 'test-basics')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, updated_at = now();

INSERT INTO study_audience_tags (label, slug)
VALUES
  ('Beginner', 'beginner'),
  ('Quick Review', 'quick-review'),
  ('Interview Prep', 'interview-prep')
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label, updated_at = now();

WITH decks(title, description, subject, tags) AS (
  VALUES
    ('[TEST_DELETE] Algebra Basics', 'Small test deck for library taxonomy checks.', 'Math', ARRAY['algebra', '__test_delete__']::text[]),
    ('[TEST_DELETE] US Capitals Mini', 'Small test deck for audience-tag filtering.', 'Geography', ARRAY['capitals', '__test_delete__']::text[]),
    ('[TEST_DELETE] Behavioral STAR Prompts', 'Small test deck for interview-prep scope.', 'Interview', ARRAY['star', '__test_delete__']::text[])
)
INSERT INTO study_decks (title, description, subject, tags, is_public, is_official)
SELECT d.title, d.description, d.subject, d.tags, true, false
FROM decks d
WHERE NOT EXISTS (
  SELECT 1 FROM study_decks existing WHERE existing.title = d.title
);

-- Rebuild cards/mappings for these test decks so reruns stay clean.
DELETE FROM study_cards
WHERE deck_id IN (SELECT id FROM study_decks WHERE title LIKE '[TEST_DELETE]%');

DELETE FROM study_deck_audience_tags
WHERE deck_id IN (SELECT id FROM study_decks WHERE title LIKE '[TEST_DELETE]%');

WITH t AS (
  SELECT id, title
  FROM study_decks
  WHERE title LIKE '[TEST_DELETE]%'
)
INSERT INTO study_cards (deck_id, question, answer, position)
SELECT t.id, c.question, c.answer, c.position
FROM t
JOIN (
  VALUES
    ('[TEST_DELETE] Algebra Basics', '2 + 2', '4', 0),
    ('[TEST_DELETE] Algebra Basics', '3 x 3', '9', 1),
    ('[TEST_DELETE] Algebra Basics', '10 - 7', '3', 2),
    ('[TEST_DELETE] US Capitals Mini', 'Capital of California', 'Sacramento', 0),
    ('[TEST_DELETE] US Capitals Mini', 'Capital of Texas', 'Austin', 1),
    ('[TEST_DELETE] US Capitals Mini', 'Capital of Florida', 'Tallahassee', 2),
    ('[TEST_DELETE] Behavioral STAR Prompts', 'S in STAR stands for?', 'Situation', 0),
    ('[TEST_DELETE] Behavioral STAR Prompts', 'T in STAR stands for?', 'Task', 1),
    ('[TEST_DELETE] Behavioral STAR Prompts', 'A in STAR stands for?', 'Action', 2)
) AS c(title, question, answer, position)
  ON c.title = t.title;

WITH tag_map AS (
  SELECT d.id AS deck_id, a.id AS audience_tag_id
  FROM study_decks d
  JOIN study_audience_tags a
    ON (d.title = '[TEST_DELETE] Algebra Basics' AND a.slug IN ('beginner', 'quick-review'))
    OR (d.title = '[TEST_DELETE] US Capitals Mini' AND a.slug IN ('beginner'))
    OR (d.title = '[TEST_DELETE] Behavioral STAR Prompts' AND a.slug IN ('interview-prep', 'quick-review'))
  WHERE d.title LIKE '[TEST_DELETE]%'
)
INSERT INTO study_deck_audience_tags (deck_id, audience_tag_id)
SELECT deck_id, audience_tag_id
FROM tag_map
ON CONFLICT DO NOTHING;

UPDATE study_decks d
SET card_count = cards.cnt, verified_card_count = 0, updated_at = now()
FROM (
  SELECT deck_id, COUNT(*)::int AS cnt
  FROM study_cards
  WHERE deck_id IN (SELECT id FROM study_decks WHERE title LIKE '[TEST_DELETE]%')
  GROUP BY deck_id
) cards
WHERE d.id = cards.deck_id;

COMMIT;
