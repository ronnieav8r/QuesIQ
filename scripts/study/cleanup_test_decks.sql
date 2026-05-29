-- Deletes Study test seed decks created by seed_test_decks.sql
-- Marker strategy:
--   title starts with [TEST_DELETE]
--   or tags include __test_delete__

BEGIN;

DELETE FROM study_decks
WHERE title LIKE '[TEST_DELETE]%'
   OR '__test_delete__' = ANY(COALESCE(tags, ARRAY[]::text[]));

COMMIT;
