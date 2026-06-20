# DPE Content Model V2

## Storage Rule

DPE content is concept-first, but not every learner experience is a question
variant.

Use four content families:

1. `Concepts`: one narrow, source-backed checkride knowledge or risk point.
2. `Drill variants`: rapid fire, coaching, multiple choice, true/false, and
   fill-in-the-blank prompts that test one Concept.
3. `Scenario cases`: applied walkthroughs with real setup, ordered steps, AI
   checkpoints, and linked Concepts/stimuli.
4. `Mock oral blueprints`: voice-session plans that select from Concepts,
   scenario cases, weak areas, and coverage policy.

Runtime must select stored authored prompts, scenarios, and blueprints. AI may
evaluate, coach, ask follow-ups, and summarize, but it must not invent the
learner-facing content path at runtime.

## Drill Concept Packet

Concept packets import only drill variants. Do not include `scenario` or
`mock_oral` inside `variants`; those are separate V2 content families.

```json
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
    "id": "required-pilot-documents",
    "title": "Required pilot documents",
    "subjectTags": ["pilot qualifications", "documents"],
    "difficulty": "foundation",
    "searchKeywords": ["certificate", "photo ID", "medical", "BasicMed"],
    "sources": [
      {
        "label": "14 CFR 61.3",
        "reference": "14 CFR 61.3",
        "url": "https://www.ecfr.gov/current/title-14/section-61.3",
        "notes": "Supports required pilot document answer."
      }
    ]
  },
  "variants": {
    "multiple_choice": {
      "prompt": "Which documents must a private pilot have available to act as PIC?",
      "choices": [
        { "id": "A", "text": "Pilot certificate, photo ID, and medical or BasicMed when required" },
        { "id": "B", "text": "Aircraft registration, radio license, and logbook" },
        { "id": "C", "text": "Photo ID only" },
        { "id": "D", "text": "Pilot certificate and aircraft insurance card" }
      ],
      "correctChoiceIds": ["A"],
      "explanation": "The question asks for pilot documents, not aircraft documents.",
      "commonMisses": ["Confusing pilot documents with aircraft documents."]
    },
    "rapid_fire": {
      "shortPrompt": "What documents do you need to act as PIC as a private pilot?",
      "idealShortAnswer": "Pilot certificate, government photo ID, and medical or BasicMed when required.",
      "acceptablePhrases": ["pilot certificate", "photo ID", "medical", "BasicMed"]
    }
  }
}
```

Quality rules:

- One Concept tests one specific point.
- Multiple choice must have one defensible best answer.
- Distractors should be plausible misconceptions, not random true facts from
  nearby topics.
- Mnemonics belong in answers or explanations, not as clues in stems.
- Fill-in-the-blank is only for exact recall facts.
- True/false is only for one unambiguous claim.

## Stimulus Packet

Stimulus packets are reusable display/context objects for images, charts,
METARs, TAFs, airport diagrams, excerpts, examples, and documents.

The learner sees the asset. The AI receives the structured context. Do not rely
on live image interpretation for correctness.

```json
{
  "stimulusPacket": {
    "id": "stimulus-kapa-metar-taf-marginal-vfr",
    "certificateTypeId": "private-pilot-asel",
    "displayTitle": "KAPA METAR/TAF marginal VFR trend",
    "assetType": "metar_taf",
    "learnerDescription": "A METAR/TAF example for a marginal VFR preflight decision.",
    "aiContext": "This packet shows a marginal VFR trend with lowering ceilings and gusty winds. The AI should use the decoded ceiling, visibility, wind, and timing from this context rather than inferring from an image.",
    "keyDetails": ["Ceiling is marginal.", "Wind is gusty.", "Forecast timing matters."],
    "interpretationNotes": ["Compare the current METAR with the forecast trend before deciding."],
    "commonMisreads": ["Treating a temporary improvement as the whole forecast."],
    "sourceLabel": "NOAA Aviation Weather Center",
    "sourceReference": "Training METAR/TAF example",
    "sourceUrl": "https://aviationweather.gov/",
    "assets": [
      {
        "type": "text",
        "label": "KAPA METAR/TAF text",
        "textContent": "KAPA 151853Z 18012G22KT 6SM BKN025..."
      }
    ],
    "links": [
      {
        "targetType": "concept",
        "targetId": "weather-go-no-go-trend",
        "requiredToAnswer": true,
        "usage": "Weather interpretation example for risk discussion."
      }
    ]
  }
}
```

## Scenario Case

Scenario cases are not wrapper prompts. They are ordered applied cases where the
student walks the AI through decisions and the AI checks specific points.

```json
{
  "scenarioCase": {
    "id": "scenario-ifr-weather-diversion",
    "certificateTypeId": "instrument-rating-airplane",
    "title": "IFR Deteriorating Destination Weather",
    "summary": "IFR weather deterioration and diversion decision scenario.",
    "aiInstructions": "Let the learner explain the decision flow, then ask checkpoints in order.",
    "steps": [
      {
        "title": "Destination weather is deteriorating",
        "scenarioText": "You are IMC near your destination and the reported ceiling is dropping.",
        "aiPrompt": "Ask what information the pilot needs before continuing.",
        "expectedPilotActions": ["Assess weather trend", "Confirm fuel and alternate options"],
        "riskPoints": ["Press-on bias"],
        "conceptIds": ["ifr-alternate-planning"],
        "stimulusPacketIds": ["stimulus-kapa-metar-taf-marginal-vfr"],
        "checkpoints": [
          {
            "prompt": "What are your first decision points before continuing this IFR flight?",
            "expectedAnswerElements": ["Weather trend", "Fuel and alternate", "ATC communication"],
            "aiEvaluationNotes": "Look for a conservative decision flow, not a memorized rule only.",
            "conceptIds": ["ifr-alternate-planning"],
            "stimulusPacketIds": ["stimulus-kapa-metar-taf-marginal-vfr"]
          }
        ]
      }
    ]
  }
}
```

## Mock Oral Blueprint

Mock oral blueprints define voice-session behavior. They are broader than a
single concept and should drive real-time examiner flow.

```json
{
  "mockOralBlueprint": {
    "id": "mock-oral-private-pilot-area-i",
    "certificateTypeId": "private-pilot-asel",
    "title": "Private Pilot Area I Mock Oral",
    "sessionMode": "voice",
    "durationMinutes": 20,
    "coveragePolicy": {
      "requiredAreas": ["I"],
      "targetQuestionCount": 8,
      "includeWeakAreas": true
    },
    "examinerStyle": "Direct, realistic, and safety-focused.",
    "aiInstructions": "Run a voice mock oral using authored Concepts and scenario cases only.",
    "conceptPool": ["required-pilot-documents"],
    "scenarioPool": ["scenario-ifr-weather-diversion"],
    "stimulusPacketIds": ["stimulus-kapa-metar-taf-marginal-vfr"]
  }
}
```

## Import Status

V2 content is content-side readiness only. It does not imply app publication,
Official status, production import, or human/expert review.
