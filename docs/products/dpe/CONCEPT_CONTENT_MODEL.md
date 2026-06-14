# DPE Concept Content Model

## Storage Rule

DPE content is stored as narrow source-backed Concepts with authored,
repeatable learner-facing variants. The runtime must select stored prompts; it
must not invent learner questions at practice time.

A Concept must have:

1. One certificate.
2. One ACS area/task/element location.
3. One narrow testable title.
4. At least one source reference.
5. At least one subject tag.
6. At least one complete question or prompt variant.

Partial mode coverage is allowed. A Concept with only multiple-choice and
rapid-fire variants is available only in those two modes.

## Mode Contract

Supported repeatable variant modes:

1. `multiple_choice`
2. `fill_blank`
3. `true_false`
4. `scenario`
5. `coaching`
6. `rapid_fire`
7. `mock_oral`

Visual modes must be scoreable from authored answer fields. Spoken modes must
use authored prompts, expected answer elements, acceptable phrases, or rubrics.
AI may evaluate, coach, and summarize spoken answers, but the prompt itself is
stored content.

## Content Creator Prompt

```text
You are creating source-backed QuesIQ DPE content.

Create structured JSON for DPE Concepts and repeatable question variants.

A Concept is one narrow, testable checkride idea under a specific certificate and ACS area/task/element. It is not a broad lesson, not a study note, and not a blob of source content. Every Concept must include at least one exact learner-facing question or prompt variant.

Return JSON only.

Required shape:

{
  "certificate": {
    "id": "private-pilot-asel",
    "code": "PRIVATE_PILOT_ASEL",
    "title": "Private Pilot Airplane Single-Engine Land"
  },
  "acs": {
    "title": "Private Pilot Airplane ACS",
    "area": "I",
    "areaTitle": "Preflight Preparation",
    "task": "A",
    "taskTitle": "Pilot Qualifications",
    "elementType": "K",
    "elementReference": "PA.I.A.K1"
  },
  "concept": {
    "id": "stable-slug-or-id",
    "title": "Required pilot documents",
    "subjectTags": ["pilot qualifications", "documents", "medical", "BasicMed"],
    "difficulty": "foundation | intermediate | checkride",
    "searchKeywords": ["certificate", "photo ID", "medical", "BasicMed"],
    "sources": [
      {
        "label": "FAA source name",
        "reference": "Exact ACS, FAR, AIM, handbook, or FAA source reference",
        "url": "source URL if available",
        "notes": "What this source supports"
      }
    ]
  },
  "variants": {
    "multiple_choice": {
      "prompt": "Exact multiple-choice question stem",
      "choices": [
        { "id": "A", "text": "Choice text" },
        { "id": "B", "text": "Choice text" },
        { "id": "C", "text": "Choice text" },
        { "id": "D", "text": "Choice text" }
      ],
      "correctChoiceIds": ["A"],
      "explanation": "Why the answer is correct",
      "commonMisses": ["Common misconception"]
    },
    "fill_blank": {
      "prompt": "Exact fill-in-the-blank prompt",
      "acceptedAnswers": ["accepted answer", "alternate accepted answer"],
      "explanation": "Concise explanation"
    },
    "true_false": {
      "statement": "Exact true/false statement",
      "correctAnswer": true,
      "correctionIfFalse": "Corrected statement if false",
      "explanation": "Concise explanation"
    },
    "scenario": {
      "scenarioSetup": "Short realistic checkride/preflight scenario",
      "question": "Exact learner-facing scenario question",
      "expectedAnswerElements": ["Element 1", "Element 2"],
      "debrief": "Scenario debrief"
    },
    "coaching": {
      "openerPrompt": "Exact spoken coaching prompt",
      "hintSequence": ["Hint 1", "Hint 2"],
      "teachingPoints": ["Point 1", "Point 2"],
      "expectedAnswerElements": ["Element 1", "Element 2"]
    },
    "rapid_fire": {
      "shortPrompt": "Exact rapid-fire oral prompt",
      "idealShortAnswer": "Concise expected answer",
      "acceptablePhrases": ["Alternate phrasing"]
    },
    "mock_oral": {
      "openerPrompt": "Exact DPE-style oral prompt",
      "followUps": ["Follow-up 1", "Follow-up 2"],
      "rubric": {
        "knowledge": "What must be correct",
        "riskManagement": "What safety judgment must appear",
        "communication": "What clear answer sounds like",
        "checkrideReadiness": "How to judge readiness"
      }
    }
  }
}

Rules:
- Every Concept must have required source references.
- Every Concept must include at least one subject tag.
- Every Concept must include at least one complete variant.
- Include all applicable variants, but omit modes that do not fit the concept.
- Visual variants must be deterministically scorable.
- Spoken variants must include authored prompts and rubrics.
- Do not invent source references.
- Do not output placeholders.
```
