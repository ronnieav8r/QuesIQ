import { readFileSync } from "node:fs";

import { parseDpeConceptPacket } from "@/server/dpe/concept-content";
import {
  parseDpeMockOralBlueprint,
  parseDpeScenarioCase,
  parseDpeStimulusPacket,
} from "@/server/dpe/content-v2";

type SmokePacket = {
  acs: Record<string, unknown>;
  certificate: Record<string, unknown>;
  concept: Record<string, unknown> & {
    sources: unknown[];
    subjectTags: unknown[];
  };
  variants: Record<string, unknown>;
};

type PilotFixture = {
  conceptPackets: unknown[];
  mockOralBlueprints: unknown[];
  scenarioCases: unknown[];
  stimulusPackets: unknown[];
};

function validPacket(): SmokePacket {
  return {
    acs: {
      area: "I",
      areaTitle: "Preflight Preparation",
      elementReference: "PA.I.A.K1",
      elementType: "K",
      task: "A",
      taskTitle: "Pilot Qualifications",
      title: "Private Pilot Airplane ACS",
    },
    certificate: {
      code: "PRIVATE_PILOT_ASEL",
      id: "private-pilot-asel",
      title: "Private Pilot Airplane Single-Engine Land",
    },
    concept: {
      difficulty: "foundation",
      id: "required-pilot-documents",
      searchKeywords: ["certificate", "medical", "BasicMed"],
      sources: [
        {
          label: "FAA source",
          notes: "Supports required pilot document answer.",
          reference: "14 CFR 61.3",
          url: "https://www.ecfr.gov/current/title-14/section-61.3",
        },
      ],
      subjectTags: ["pilot qualifications", "documents"],
      title: "Required pilot documents",
    },
    variants: {
      multiple_choice: {
        choices: [
          { id: "A", text: "Pilot certificate, photo ID, and medical or BasicMed when required" },
          { id: "B", text: "Logbook, aircraft registration, and medical certificate" },
          { id: "C", text: "Photo ID only" },
          { id: "D", text: "Pilot certificate and radio license" },
        ],
        commonMisses: ["Confusing aircraft documents with pilot documents."],
        correctChoiceIds: ["A"],
        explanation: "A private pilot needs the required pilot documents, not aircraft documents.",
        prompt: "Which documents must a private pilot have available to act as PIC?",
      },
      rapid_fire: {
        acceptablePhrases: ["pilot certificate", "photo ID", "medical", "BasicMed"],
        idealShortAnswer: "Pilot certificate, government photo ID, and medical or BasicMed when required.",
        shortPrompt: "What documents do you need to act as PIC as a private pilot?",
      },
    },
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const pilotFixture = JSON.parse(
  readFileSync(new URL("../../docs/products/dpe/pilots/ira-v2-pilot.json", import.meta.url), "utf8"),
) as PilotFixture;
assert(pilotFixture.conceptPackets.length === 10, "IRA V2 pilot should include 10 concept packets");
assert(pilotFixture.stimulusPackets.length === 2, "IRA V2 pilot should include 2 stimulus packets");
assert(pilotFixture.scenarioCases.length === 1, "IRA V2 pilot should include 1 scenario case");
assert(pilotFixture.mockOralBlueprints.length === 1, "IRA V2 pilot should include 1 mock oral blueprint");

for (const [index, packet] of pilotFixture.conceptPackets.entries()) {
  const parsed = parseDpeConceptPacket(packet);
  assert(parsed.ok, parsed.ok ? `pilot concept packet ${index} parsed` : parsed.error);
}

for (const [index, packet] of pilotFixture.stimulusPackets.entries()) {
  const parsed = parseDpeStimulusPacket(packet);
  assert(parsed.ok, parsed.ok ? `pilot stimulus packet ${index} parsed` : parsed.error);
}

for (const [index, scenario] of pilotFixture.scenarioCases.entries()) {
  const parsed = parseDpeScenarioCase(scenario);
  assert(parsed.ok, parsed.ok ? `pilot scenario case ${index} parsed` : parsed.error);
}

for (const [index, blueprint] of pilotFixture.mockOralBlueprints.entries()) {
  const parsed = parseDpeMockOralBlueprint(blueprint);
  assert(parsed.ok, parsed.ok ? `pilot mock oral blueprint ${index} parsed` : parsed.error);
}

const valid = parseDpeConceptPacket(validPacket());
assert(valid.ok, valid.ok ? "valid packet parsed" : valid.error);
assert(valid.ok && valid.value.variants.length === 2, "valid packet should parse two variants");

const noSources = validPacket();
noSources.concept.sources = [];
const missingSources = parseDpeConceptPacket(noSources);
assert(!missingSources.ok, "packet without sources should fail");

const noSubjectTags = validPacket();
noSubjectTags.concept.subjectTags = [];
const missingSubjectTags = parseDpeConceptPacket(noSubjectTags);
assert(!missingSubjectTags.ok, "packet without subject tags should fail");

const noVariants = validPacket();
noVariants.variants = {};
const missingVariants = parseDpeConceptPacket(noVariants);
assert(!missingVariants.ok, "packet without variants should fail");

const badMc = validPacket();
const multipleChoice = badMc.variants.multiple_choice;
assert(
  Boolean(multipleChoice) && typeof multipleChoice === "object" && !Array.isArray(multipleChoice),
  "smoke packet should include a multiple-choice variant",
);
(multipleChoice as { correctChoiceIds: unknown[] }).correctChoiceIds = [];
const invalidMc = parseDpeConceptPacket(badMc);
assert(!invalidMc.ok, "multiple choice without a correct choice should fail");

const scenarioVariant = validPacket();
scenarioVariant.variants.scenario = {
  debrief: "This should be a separate V2 scenario case.",
  expectedAnswerElements: ["A conservative decision"],
  question: "What would you do next?",
  scenarioSetup: "You are planning an IFR flight with worsening weather.",
};
const invalidScenarioVariant = parseDpeConceptPacket(scenarioVariant);
assert(!invalidScenarioVariant.ok, "scenario variants should not be accepted inside concept drill packets");

const mockOralVariant = validPacket();
mockOralVariant.variants.mock_oral = {
  followUps: ["Show me how you would apply that."],
  openerPrompt: "Walk me through pilot qualifications.",
  rubric: {
    checkrideReadiness: "Answer is checkride-ready.",
    communication: "Answer is concise.",
    knowledge: "Core facts are correct.",
    riskManagement: "Risk judgment is conservative.",
  },
};
const invalidMockOralVariant = parseDpeConceptPacket(mockOralVariant);
assert(!invalidMockOralVariant.ok, "mock oral variants should not be accepted inside concept drill packets");

const validStimulus = parseDpeStimulusPacket({
  stimulusPacket: {
    aiContext:
      "This METAR/TAF packet shows a marginal VFR trend with a lowering ceiling and gusty wind. The AI should use the decoded ceiling, visibility, wind, and trend timing rather than inferring from an image.",
    assetType: "metar_taf",
    assets: [
      {
        label: "KAPA METAR/TAF text",
        textContent: "KAPA 151853Z 18012G22KT 6SM BKN025...",
        type: "text",
      },
    ],
    commonMisreads: ["Treating a temporary improvement as the whole forecast."],
    displayTitle: "KAPA METAR/TAF marginal VFR trend",
    id: "stimulus-kapa-marginal-vfr",
    interpretationNotes: ["Compare the current METAR with the forecast trend before deciding."],
    keyDetails: ["Ceiling is marginal.", "Wind is gusty.", "Forecast timing matters."],
    learnerDescription: "A METAR/TAF example for a marginal VFR preflight decision.",
    links: [
      {
        requiredToAnswer: true,
        targetId: "required-pilot-documents",
        targetType: "concept",
        usage: "Weather interpretation example for risk discussion.",
      },
    ],
    sourceLabel: "NOAA Aviation Weather Center",
    sourceReference: "Training METAR/TAF example",
  },
});
assert(validStimulus.ok, validStimulus.ok ? "valid stimulus parsed" : validStimulus.error);

const invalidStimulus = parseDpeStimulusPacket({
  stimulusPacket: {
    assetType: "image",
    assets: [{ label: "Approach image", type: "image", url: "https://example.com/chart.png" }],
    displayTitle: "Approach image with no AI context",
    id: "stimulus-no-ai-context",
    keyDetails: ["Localizer frequency shown."],
    learnerDescription: "An approach chart image.",
    sourceLabel: "FAA",
    sourceReference: "Chart excerpt",
  },
});
assert(!invalidStimulus.ok, "stimulus without AI context should fail");

const validScenario = parseDpeScenarioCase({
  scenarioCase: {
    aiInstructions: "Let the learner walk through the decision, then ask checkpoints in order.",
    id: "scenario-ifr-weather-diversion",
    steps: [
      {
        aiPrompt: "Ask what information the pilot needs before continuing.",
        checkpoints: [
          {
            aiEvaluationNotes: "Look for weather trend, alternate, fuel, terrain, and ATC communication.",
            expectedAnswerElements: ["Weather trend", "Fuel and alternate", "ATC communication"],
            prompt: "What are your first decision points before continuing this IFR flight?",
          },
        ],
        expectedPilotActions: ["Assess weather trend", "Confirm fuel and alternate options"],
        riskPoints: ["Press-on bias"],
        scenarioText: "You are IMC near your destination and the reported ceiling is dropping.",
        title: "Destination weather is deteriorating",
      },
    ],
    summary: "IFR weather deterioration and diversion decision scenario.",
    title: "IFR Deteriorating Destination Weather",
  },
});
assert(validScenario.ok, validScenario.ok ? "valid scenario parsed" : validScenario.error);

const validMockOral = parseDpeMockOralBlueprint({
  mockOralBlueprint: {
    aiInstructions: "Run a voice mock oral using authored concepts and scenario cases only.",
    conceptPool: ["required-pilot-documents"],
    coveragePolicy: { requiredAreas: ["I"], targetQuestionCount: 8 },
    examinerStyle: "Direct, realistic, and safety-focused.",
    id: "mock-oral-private-pilot-area-i",
    scenarioPool: ["scenario-ifr-weather-diversion"],
    sessionMode: "voice",
    title: "Private Pilot Area I Mock Oral",
  },
});
assert(validMockOral.ok, validMockOral.ok ? "valid mock oral parsed" : validMockOral.error);

console.log("DPE concept and V2 content smoke passed");
