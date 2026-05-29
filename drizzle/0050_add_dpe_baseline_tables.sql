CREATE TABLE IF NOT EXISTS dpe_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  preferred_name text,
  aircraft text,
  flight_school text,
  instructor text,
  known_dpe_name text,
  personal_notes text,
  weak_area_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dpe_profiles_user_idx ON dpe_profiles (user_id);

CREATE TABLE IF NOT EXISTS dpe_checkride_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  certificate text NOT NULL,
  aircraft_category text NOT NULL,
  aircraft_class text NOT NULL,
  checkride_date timestamp with time zone,
  known_dpe_name text,
  aircraft text,
  school_context text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dpe_checkride_targets_user_idx ON dpe_checkride_targets (user_id);

CREATE TABLE IF NOT EXISTS dpe_certificate_types (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  category text,
  aircraft_class text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dpe_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type_id text NOT NULL REFERENCES dpe_certificate_types(id) ON DELETE cascade,
  version integer NOT NULL,
  status text NOT NULL,
  title text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dpe_content_versions_certificate_version_idx
  ON dpe_content_versions (certificate_type_id, version);
CREATE INDEX IF NOT EXISTS dpe_content_versions_status_idx ON dpe_content_versions (status);

CREATE TABLE IF NOT EXISTS dpe_oral_questions (
  id text PRIMARY KEY,
  certificate_type_id text REFERENCES dpe_certificate_types(id) ON DELETE set null,
  content_version_id uuid REFERENCES dpe_content_versions(id) ON DELETE set null,
  acs_title text NOT NULL,
  acs_area text NOT NULL,
  acs_task text NOT NULL,
  acs_element_type text NOT NULL,
  acs_element_reference text NOT NULL,
  question_mode text NOT NULL,
  question_text text NOT NULL,
  difficulty text,
  keywords text,
  primary_subject text,
  ai_context text,
  visual_image text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dpe_oral_questions_acs_idx
  ON dpe_oral_questions (acs_title, acs_area, acs_task);
CREATE INDEX IF NOT EXISTS dpe_oral_questions_certificate_acs_idx
  ON dpe_oral_questions (certificate_type_id, acs_area, acs_task);
CREATE INDEX IF NOT EXISTS dpe_oral_questions_element_idx
  ON dpe_oral_questions (acs_element_reference);

CREATE TABLE IF NOT EXISTS dpe_question_answer_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL UNIQUE REFERENCES dpe_oral_questions(id) ON DELETE cascade,
  status text NOT NULL,
  correct_answer_elements jsonb NOT NULL,
  acceptable_variations jsonb,
  common_misses jsonb,
  source_references jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dpe_question_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id text NOT NULL UNIQUE REFERENCES dpe_oral_questions(id) ON DELETE cascade,
  status text NOT NULL,
  knowledge text NOT NULL,
  risk_management text NOT NULL,
  scenario_judgment text NOT NULL,
  communication text NOT NULL,
  checkride_readiness text NOT NULL,
  scoring_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dpe_practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
  checkride_target_id uuid REFERENCES dpe_checkride_targets(id) ON DELETE set null,
  mode text NOT NULL,
  status text NOT NULL,
  acs_title text NOT NULL,
  acs_area text,
  acs_task text,
  prompt_config_key text,
  prompt_config_version integer,
  transcript_json jsonb,
  review_json jsonb,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dpe_practice_sessions_user_created_idx
  ON dpe_practice_sessions (user_id, created_at);
CREATE INDEX IF NOT EXISTS dpe_practice_sessions_acs_idx
  ON dpe_practice_sessions (acs_title, acs_area, acs_task);

CREATE TABLE IF NOT EXISTS dpe_session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES dpe_practice_sessions(id) ON DELETE cascade,
  question_id text NOT NULL REFERENCES dpe_oral_questions(id) ON DELETE restrict,
  sort_order integer NOT NULL,
  response text
);

CREATE UNIQUE INDEX IF NOT EXISTS dpe_session_questions_session_question_idx
  ON dpe_session_questions (session_id, question_id);

CREATE TABLE IF NOT EXISTS dpe_diagnostic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES dpe_practice_sessions(id) ON DELETE set null,
  surface text NOT NULL,
  severity text NOT NULL,
  code text,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dpe_diagnostic_events_surface_created_idx
  ON dpe_diagnostic_events (surface, created_at);

INSERT INTO dpe_certificate_types (id, code, title, category, aircraft_class, active)
VALUES (
  'private-pilot-asel',
  'PRIVATE_PILOT_ASEL',
  'Private Pilot Airplane Single-Engine Land',
  'Airplane',
  'Single-Engine Land',
  true
)
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    category = EXCLUDED.category,
    aircraft_class = EXCLUDED.aircraft_class,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO dpe_content_versions (certificate_type_id, version, status, title, notes)
VALUES (
  'private-pilot-asel',
  1,
  'placeholder',
  'Private Pilot ASEL Placeholder Content',
  'Temporary scaffolding content. Not final product content.'
)
ON CONFLICT (certificate_type_id, version) DO UPDATE
SET status = EXCLUDED.status,
    title = EXCLUDED.title,
    notes = EXCLUDED.notes,
    updated_at = now();

WITH content_version AS (
  SELECT id FROM dpe_content_versions
  WHERE certificate_type_id = 'private-pilot-asel' AND version = 1
)
INSERT INTO dpe_oral_questions (
  id,
  certificate_type_id,
  content_version_id,
  acs_title,
  acs_area,
  acs_task,
  acs_element_type,
  acs_element_reference,
  question_mode,
  question_text,
  difficulty,
  keywords,
  primary_subject,
  ai_context,
  visual_image,
  active
)
VALUES
  (
    'PLACEHOLDER-PA-I-A-001',
    'private-pilot-asel',
    (SELECT id FROM content_version),
    'Private Pilot Airplane',
    'I',
    'A',
    'K',
    'PA.I.A.K1',
    'verbal',
    'Placeholder: What documents must a private pilot have available to act as pilot in command?',
    'Placeholder',
    'placeholder||pilot certificate||medical||photo identification',
    'Placeholder Content',
    '{"answerKeyStatus":"placeholder","taskTitle":"Pilot Qualifications","promptType":"recall","practiceLane":"oral","supportsHandsFree":true,"provisionalAnswerKey":"Placeholder answer key: expected answer should cover pilot certificate, government photo identification, and medical certificate or BasicMed qualification when required. This is not final product content.","scoringRubric":{"knowledge":"Placeholder rubric: check whether required documents are named accurately.","riskManagement":"Placeholder rubric: note whether the applicant understands legality before flight.","scenarioJudgment":"Placeholder rubric: give credit for applying the answer to a PIC scenario.","communication":"Placeholder rubric: answer should be concise and organized.","checkrideReadiness":"Placeholder rubric: score conservatively because final content is not authored."}}',
    null,
    true
  ),
  (
    'PLACEHOLDER-PA-I-A-002',
    'private-pilot-asel',
    (SELECT id FROM content_version),
    'Private Pilot Airplane',
    'I',
    'A',
    'K',
    'PA.I.A.K2',
    'verbal',
    'Placeholder: What are some privileges and limitations of a private pilot certificate?',
    'Placeholder',
    'placeholder||privileges||limitations||compensation',
    'Placeholder Content',
    '{"answerKeyStatus":"placeholder","taskTitle":"Pilot Qualifications","promptType":"explain","practiceLane":"oral","supportsHandsFree":true,"provisionalAnswerKey":"Placeholder answer key: expected answer should mention no flying for compensation or hire, pro rata expense sharing limits, charitable/search-and-rescue exceptions at a high level, and acting as PIC within category/class/endorsement limitations. This is not final product content.","scoringRubric":{"knowledge":"Placeholder rubric: check whether core privilege/limitation ideas are accurate.","riskManagement":"Placeholder rubric: identify unsafe or illegal compensation assumptions.","scenarioJudgment":"Placeholder rubric: credit practical examples of what is and is not allowed.","communication":"Placeholder rubric: answer should avoid rambling and distinguish privileges from limits.","checkrideReadiness":"Placeholder rubric: score conservatively because final content is not authored."}}',
    null,
    true
  ),
  (
    'PLACEHOLDER-PA-I-B-001',
    'private-pilot-asel',
    (SELECT id FROM content_version),
    'Private Pilot Airplane',
    'I',
    'B',
    'K',
    'PA.I.B.K1',
    'verbal',
    'Placeholder: How would you determine whether an aircraft is airworthy before a flight?',
    'Placeholder',
    'placeholder||airworthiness||AROW||inspections||ADs',
    'Placeholder Content',
    '{"answerKeyStatus":"placeholder","taskTitle":"Airworthiness Requirements","promptType":"explain","practiceLane":"oral","supportsHandsFree":true,"provisionalAnswerKey":"Placeholder answer key: expected answer should cover required documents, required inspections, AD compliance, equipment status, maintenance records, and pilot preflight determination. This is not final product content.","scoringRubric":{"knowledge":"Placeholder rubric: check whether documents, inspections, and ADs are covered.","riskManagement":"Placeholder rubric: credit conservative no-go decisions when airworthiness is uncertain.","scenarioJudgment":"Placeholder rubric: credit applying the process to a real preflight.","communication":"Placeholder rubric: answer should present a clear sequence.","checkrideReadiness":"Placeholder rubric: score conservatively because final content is not authored."}}',
    null,
    true
  ),
  (
    'PLACEHOLDER-PA-I-C-001',
    'private-pilot-asel',
    (SELECT id FROM content_version),
    'Private Pilot Airplane',
    'I',
    'C',
    'K',
    'PA.I.C.K1',
    'verbal',
    'Placeholder: What weather information would you review before a day VFR cross-country flight?',
    'Placeholder',
    'placeholder||weather||METAR||TAF||winds aloft||NOTAM',
    'Placeholder Content',
    '{"answerKeyStatus":"placeholder","taskTitle":"Weather Information","promptType":"scenario","practiceLane":"oral","supportsHandsFree":true,"provisionalAnswerKey":"Placeholder answer key: expected answer should cover current conditions, forecasts, winds aloft, NOTAMs, adverse weather, TFRs, ceilings/visibility, and trend evaluation. This is not final product content.","scoringRubric":{"knowledge":"Placeholder rubric: check whether key preflight weather products are named.","riskManagement":"Placeholder rubric: credit identifying weather trends and personal minimums.","scenarioJudgment":"Placeholder rubric: credit go/no-go thinking for a VFR cross-country.","communication":"Placeholder rubric: answer should be structured as a briefing flow.","checkrideReadiness":"Placeholder rubric: score conservatively because final content is not authored."}}',
    null,
    true
  ),
  (
    'PLACEHOLDER-PA-I-C-002',
    'private-pilot-asel',
    (SELECT id FROM content_version),
    'Private Pilot Airplane',
    'I',
    'C',
    'R',
    'PA.I.C.R1',
    'verbal',
    'Placeholder: If the forecast is legal VFR but trending worse along your route, how would you make the go/no-go decision?',
    'Placeholder',
    'placeholder||weather risk||personal minimums||alternate plan',
    'Placeholder Content',
    '{"answerKeyStatus":"placeholder","taskTitle":"Weather Information","promptType":"scenario","practiceLane":"oral","supportsHandsFree":true,"provisionalAnswerKey":"Placeholder answer key: expected answer should cover personal minimums, route/alternate options, fuel and daylight margins, delaying/canceling, and avoiding scud running or press-on bias. This is not final product content.","scoringRubric":{"knowledge":"Placeholder rubric: check whether legal VFR is distinguished from safe VFR.","riskManagement":"Placeholder rubric: heavily reward conservative mitigation and no-go judgment.","scenarioJudgment":"Placeholder rubric: credit concrete alternate plans and decision triggers.","communication":"Placeholder rubric: answer should sound like a clear PIC decision.","checkrideReadiness":"Placeholder rubric: score conservatively because final content is not authored."}}',
    null,
    true
  )
ON CONFLICT (id) DO UPDATE
SET certificate_type_id = EXCLUDED.certificate_type_id,
    content_version_id = EXCLUDED.content_version_id,
    acs_title = EXCLUDED.acs_title,
    acs_area = EXCLUDED.acs_area,
    acs_task = EXCLUDED.acs_task,
    acs_element_type = EXCLUDED.acs_element_type,
    acs_element_reference = EXCLUDED.acs_element_reference,
    question_mode = EXCLUDED.question_mode,
    question_text = EXCLUDED.question_text,
    difficulty = EXCLUDED.difficulty,
    keywords = EXCLUDED.keywords,
    primary_subject = EXCLUDED.primary_subject,
    ai_context = EXCLUDED.ai_context,
    visual_image = EXCLUDED.visual_image,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO dpe_question_answer_keys (
  question_id,
  status,
  correct_answer_elements,
  acceptable_variations,
  common_misses,
  source_references,
  notes
)
SELECT
  id,
  'placeholder',
  jsonb_build_array((ai_context::jsonb)->>'provisionalAnswerKey'),
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  'Placeholder answer key. Replace before final content approval.'
FROM dpe_oral_questions
WHERE id LIKE 'PLACEHOLDER-PA-%'
ON CONFLICT (question_id) DO UPDATE
SET status = EXCLUDED.status,
    correct_answer_elements = EXCLUDED.correct_answer_elements,
    acceptable_variations = EXCLUDED.acceptable_variations,
    common_misses = EXCLUDED.common_misses,
    source_references = EXCLUDED.source_references,
    notes = EXCLUDED.notes,
    updated_at = now();

INSERT INTO dpe_question_rubrics (
  question_id,
  status,
  knowledge,
  risk_management,
  scenario_judgment,
  communication,
  checkride_readiness,
  scoring_notes
)
SELECT
  id,
  'placeholder',
  (ai_context::jsonb)->'scoringRubric'->>'knowledge',
  (ai_context::jsonb)->'scoringRubric'->>'riskManagement',
  (ai_context::jsonb)->'scoringRubric'->>'scenarioJudgment',
  (ai_context::jsonb)->'scoringRubric'->>'communication',
  (ai_context::jsonb)->'scoringRubric'->>'checkrideReadiness',
  'Placeholder rubric. Replace before final content approval.'
FROM dpe_oral_questions
WHERE id LIKE 'PLACEHOLDER-PA-%'
ON CONFLICT (question_id) DO UPDATE
SET status = EXCLUDED.status,
    knowledge = EXCLUDED.knowledge,
    risk_management = EXCLUDED.risk_management,
    scenario_judgment = EXCLUDED.scenario_judgment,
    communication = EXCLUDED.communication,
    checkride_readiness = EXCLUDED.checkride_readiness,
    scoring_notes = EXCLUDED.scoring_notes,
    updated_at = now();
