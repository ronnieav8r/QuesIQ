import { parseDpeConceptPacket } from "@/server/dpe/concept-content";

type SmokePacket = {
  acs: Record<string, unknown>;
  certificate: Record<string, unknown>;
  concept: Record<string, unknown> & {
    sources: unknown[];
    subjectTags: unknown[];
  };
  variants: Record<string, unknown>;
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

console.log("DPE concept content smoke passed");
