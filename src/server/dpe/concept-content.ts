import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  dpeCertificateTypes,
  dpeConcepts,
  dpeConceptSources,
  dpeConceptTags,
  dpeContentVersions,
  dpeQuestionVariants,
  dpeSubjectTags,
} from "@/server/db/schema";

export const dpeConceptVariantModes = [
  "multiple_choice",
  "fill_blank",
  "true_false",
  "coaching",
  "rapid_fire",
] as const;

export type DpeConceptVariantMode = (typeof dpeConceptVariantModes)[number];

type ValidationResult<T> = { ok: true; value: T } | { error: string; ok: false };

type DpeConceptSourceInput = {
  label: string;
  notes: string | null;
  reference: string;
  url: string | null;
};

type DpeConceptVariantInput = {
  acceptedAnswers?: string[];
  acceptablePhrases?: string[];
  choices?: Array<{ id: string; text: string }>;
  commonMisses?: string[];
  correctionIfFalse?: string | null;
  correctAnswerBoolean?: boolean | null;
  correctChoiceIds?: string[];
  debrief?: string | null;
  explanation?: string | null;
  expectedAnswerElements?: string[];
  hintSequence?: string[];
  idealShortAnswer?: string | null;
  mode: DpeConceptVariantMode;
  prompt: string;
  teachingPoints?: string[];
};

export type DpeConceptPacket = {
  acs: {
    area: string;
    areaTitle: string | null;
    elementReference: string;
    elementType: string;
    task: string;
    taskTitle: string | null;
    title: string;
  };
  certificate: {
    code: string;
    id: string;
    title: string;
  };
  concept: {
    difficulty: string | null;
    id: string;
    searchKeywords: string[];
    sources: DpeConceptSourceInput[];
    subjectTags: string[];
    title: string;
  };
  variants: DpeConceptVariantInput[];
};

export type DpeConceptFilters = {
  acsArea?: string;
  acsTask?: string;
  certificateTypeId?: string;
  mode?: DpeConceptVariantMode;
  query?: string;
  tags?: string[];
};

const maxTextLength = 8000;

function cleanText(value: unknown, field: string, maxLength = maxTextLength) {
  if (typeof value !== "string") {
    return { error: `${field} is required.`, ok: false as const };
  }

  const text = value.trim();
  if (!text) return { error: `${field} is required.`, ok: false as const };
  if (text.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer.`, ok: false as const };
  }

  return { ok: true as const, value: text };
}

function cleanOptionalText(value: unknown, field: string, maxLength = maxTextLength) {
  if (value === undefined || value === null) return { ok: true as const, value: null };
  if (typeof value !== "string") return { error: `${field} must be text.`, ok: false as const };
  const text = value.trim();
  if (!text) return { ok: true as const, value: null };
  if (text.length > maxLength) {
    return { error: `${field} must be ${maxLength} characters or fewer.`, ok: false as const };
  }

  return { ok: true as const, value: text };
}

function cleanStringList(value: unknown, field: string, required = false, maxItems = 40) {
  if (value === undefined || value === null) {
    return required
      ? { error: `${field} requires at least one item.`, ok: false as const }
      : { ok: true as const, value: [] };
  }

  if (!Array.isArray(value)) return { error: `${field} must be a list.`, ok: false as const };

  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

  if (required && list.length === 0) {
    return { error: `${field} requires at least one item.`, ok: false as const };
  }

  return { ok: true as const, value: [...new Set(list)] };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function objectValue(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: `${field} must be an object.`, ok: false as const };
  }

  return { ok: true as const, value: value as Record<string, unknown> };
}

function parseSources(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "concept.sources requires at least one source.", ok: false as const };
  }

  const sources: DpeConceptSourceInput[] = [];
  for (const [index, sourceValue] of value.entries()) {
    const source = objectValue(sourceValue, `concept.sources[${index}]`);
    if (!source.ok) return source;
    const label = cleanText(source.value.label, `concept.sources[${index}].label`, 300);
    const reference = cleanText(source.value.reference, `concept.sources[${index}].reference`, 1000);
    const url = cleanOptionalText(source.value.url, `concept.sources[${index}].url`, 1000);
    const notes = cleanOptionalText(source.value.notes, `concept.sources[${index}].notes`, 2000);
    if (!label.ok) return label;
    if (!reference.ok) return reference;
    if (!url.ok) return url;
    if (!notes.ok) return notes;
    sources.push({ label: label.value, notes: notes.value, reference: reference.value, url: url.value });
  }

  return { ok: true as const, value: sources };
}

function parseChoices(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length < 2) {
    return { error: `${field} requires at least two choices.`, ok: false as const };
  }

  const choices: Array<{ id: string; text: string }> = [];
  for (const [index, choiceValue] of value.entries()) {
    const choice = objectValue(choiceValue, `${field}[${index}]`);
    if (!choice.ok) return choice;
    const id = cleanText(choice.value.id, `${field}[${index}].id`, 20);
    const text = cleanText(choice.value.text, `${field}[${index}].text`, 1000);
    if (!id.ok) return id;
    if (!text.ok) return text;
    choices.push({ id: id.value, text: text.value });
  }

  return { ok: true as const, value: choices };
}

function parseVariant(mode: DpeConceptVariantMode, rawVariant: unknown): ValidationResult<DpeConceptVariantInput> {
  const candidate = objectValue(rawVariant, `variants.${mode}`);
  if (!candidate.ok) return candidate;

  if (mode === "multiple_choice") {
    const prompt = cleanText(candidate.value.prompt, "variants.multiple_choice.prompt");
    const choices = parseChoices(candidate.value.choices, "variants.multiple_choice.choices");
    const correctChoiceIds = cleanStringList(candidate.value.correctChoiceIds, "variants.multiple_choice.correctChoiceIds", true, 10);
    const explanation = cleanText(candidate.value.explanation, "variants.multiple_choice.explanation");
    const commonMisses = cleanStringList(candidate.value.commonMisses, "variants.multiple_choice.commonMisses");
    if (!prompt.ok) return prompt;
    if (!choices.ok) return choices;
    if (!correctChoiceIds.ok) return correctChoiceIds;
    if (!explanation.ok) return explanation;
    if (!commonMisses.ok) return commonMisses;
    return {
      ok: true,
      value: {
        choices: choices.value,
        commonMisses: commonMisses.value,
        correctChoiceIds: correctChoiceIds.value,
        explanation: explanation.value,
        mode,
        prompt: prompt.value,
      },
    };
  }

  if (mode === "fill_blank") {
    const prompt = cleanText(candidate.value.prompt, "variants.fill_blank.prompt");
    const acceptedAnswers = cleanStringList(candidate.value.acceptedAnswers, "variants.fill_blank.acceptedAnswers", true);
    const explanation = cleanText(candidate.value.explanation, "variants.fill_blank.explanation");
    if (!prompt.ok) return prompt;
    if (!acceptedAnswers.ok) return acceptedAnswers;
    if (!explanation.ok) return explanation;
    return {
      ok: true,
      value: { acceptedAnswers: acceptedAnswers.value, explanation: explanation.value, mode, prompt: prompt.value },
    };
  }

  if (mode === "true_false") {
    const statement = cleanText(candidate.value.statement, "variants.true_false.statement");
    const explanation = cleanText(candidate.value.explanation, "variants.true_false.explanation");
    const correctionIfFalse = cleanOptionalText(candidate.value.correctionIfFalse, "variants.true_false.correctionIfFalse");
    if (!statement.ok) return statement;
    if (!explanation.ok) return explanation;
    if (!correctionIfFalse.ok) return correctionIfFalse;
    if (typeof candidate.value.correctAnswer !== "boolean") {
      return { error: "variants.true_false.correctAnswer must be true or false.", ok: false };
    }
    return {
      ok: true,
      value: {
        correctAnswerBoolean: candidate.value.correctAnswer,
        correctionIfFalse: correctionIfFalse.value,
        explanation: explanation.value,
        mode,
        prompt: statement.value,
      },
    };
  }

  if (mode === "coaching") {
    const openerPrompt = cleanText(candidate.value.openerPrompt, "variants.coaching.openerPrompt");
    const hintSequence = cleanStringList(candidate.value.hintSequence, "variants.coaching.hintSequence");
    const teachingPoints = cleanStringList(candidate.value.teachingPoints, "variants.coaching.teachingPoints", true);
    const expectedAnswerElements = cleanStringList(candidate.value.expectedAnswerElements, "variants.coaching.expectedAnswerElements", true);
    if (!openerPrompt.ok) return openerPrompt;
    if (!hintSequence.ok) return hintSequence;
    if (!teachingPoints.ok) return teachingPoints;
    if (!expectedAnswerElements.ok) return expectedAnswerElements;
    return {
      ok: true,
      value: {
        expectedAnswerElements: expectedAnswerElements.value,
        hintSequence: hintSequence.value,
        mode,
        prompt: openerPrompt.value,
        teachingPoints: teachingPoints.value,
      },
    };
  }

  if (mode === "rapid_fire") {
    const shortPrompt = cleanText(candidate.value.shortPrompt, "variants.rapid_fire.shortPrompt");
    const idealShortAnswer = cleanText(candidate.value.idealShortAnswer, "variants.rapid_fire.idealShortAnswer");
    const acceptablePhrases = cleanStringList(candidate.value.acceptablePhrases, "variants.rapid_fire.acceptablePhrases");
    if (!shortPrompt.ok) return shortPrompt;
    if (!idealShortAnswer.ok) return idealShortAnswer;
    if (!acceptablePhrases.ok) return acceptablePhrases;
    return {
      ok: true,
      value: {
        acceptablePhrases: acceptablePhrases.value,
        idealShortAnswer: idealShortAnswer.value,
        mode,
        prompt: shortPrompt.value,
      },
    };
  }

  return { error: `Unsupported drill variant mode: ${mode}.`, ok: false };
}

function parseVariants(value: unknown) {
  const variantsObject = objectValue(value, "variants");
  if (!variantsObject.ok) return variantsObject;

  if (variantsObject.value.scenario !== undefined || variantsObject.value.mock_oral !== undefined) {
    return {
      error:
        "Scenario cases and mock oral blueprints are V2 content families, not drill variants. Submit them through their dedicated DPE content endpoints.",
      ok: false as const,
    };
  }

  const variants: DpeConceptVariantInput[] = [];
  for (const mode of dpeConceptVariantModes) {
    if (variantsObject.value[mode] === undefined || variantsObject.value[mode] === null) {
      continue;
    }
    const parsed = parseVariant(mode, variantsObject.value[mode]);
    if (!parsed.ok) return parsed;
    variants.push(parsed.value);
  }

  if (variants.length === 0) {
    return { error: "At least one complete learner-facing variant is required.", ok: false as const };
  }

  return { ok: true as const, value: variants };
}

export function parseDpeConceptPacket(body: unknown): ValidationResult<DpeConceptPacket> {
  const root = objectValue(body, "packet");
  if (!root.ok) return root;

  const certificate = objectValue(root.value.certificate, "certificate");
  const acs = objectValue(root.value.acs, "acs");
  const concept = objectValue(root.value.concept, "concept");
  const variants = parseVariants(root.value.variants);
  if (!certificate.ok) return certificate;
  if (!acs.ok) return acs;
  if (!concept.ok) return concept;
  if (!variants.ok) return variants;

  const certificateId = cleanText(certificate.value.id, "certificate.id", 120);
  const certificateCode = cleanText(certificate.value.code, "certificate.code", 120);
  const certificateTitle = cleanText(certificate.value.title, "certificate.title", 300);
  const acsTitle = cleanText(acs.value.title, "acs.title", 300);
  const acsArea = cleanText(acs.value.area, "acs.area", 20);
  const acsAreaTitle = cleanOptionalText(acs.value.areaTitle, "acs.areaTitle", 300);
  const acsTask = cleanText(acs.value.task, "acs.task", 20);
  const acsTaskTitle = cleanOptionalText(acs.value.taskTitle, "acs.taskTitle", 300);
  const acsElementType = cleanText(acs.value.elementType, "acs.elementType", 40);
  const acsElementReference = cleanText(acs.value.elementReference, "acs.elementReference", 120);
  const conceptId = cleanText(concept.value.id, "concept.id", 180);
  const conceptTitle = cleanText(concept.value.title, "concept.title", 300);
  const subjectTags = cleanStringList(concept.value.subjectTags, "concept.subjectTags", true);
  const searchKeywords = cleanStringList(concept.value.searchKeywords, "concept.searchKeywords");
  const difficulty = cleanOptionalText(concept.value.difficulty, "concept.difficulty", 80);
  const sources = parseSources(concept.value.sources);

  if (!certificateId.ok) return certificateId;
  if (!certificateCode.ok) return certificateCode;
  if (!certificateTitle.ok) return certificateTitle;
  if (!acsTitle.ok) return acsTitle;
  if (!acsArea.ok) return acsArea;
  if (!acsAreaTitle.ok) return acsAreaTitle;
  if (!acsTask.ok) return acsTask;
  if (!acsTaskTitle.ok) return acsTaskTitle;
  if (!acsElementType.ok) return acsElementType;
  if (!acsElementReference.ok) return acsElementReference;
  if (!conceptId.ok) return conceptId;
  if (!conceptTitle.ok) return conceptTitle;
  if (!subjectTags.ok) return subjectTags;
  if (!searchKeywords.ok) return searchKeywords;
  if (!difficulty.ok) return difficulty;
  if (!sources.ok) return sources;

  return {
    ok: true,
    value: {
      acs: {
        area: acsArea.value,
        areaTitle: acsAreaTitle.value,
        elementReference: acsElementReference.value,
        elementType: acsElementType.value,
        task: acsTask.value,
        taskTitle: acsTaskTitle.value,
        title: acsTitle.value,
      },
      certificate: {
        code: certificateCode.value,
        id: certificateId.value,
        title: certificateTitle.value,
      },
      concept: {
        difficulty: difficulty.value,
        id: conceptId.value,
        searchKeywords: searchKeywords.value,
        sources: sources.value,
        subjectTags: subjectTags.value,
        title: conceptTitle.value,
      },
      variants: variants.value,
    },
  };
}

function buildSearchText(packet: DpeConceptPacket) {
  return [
    packet.certificate.code,
    packet.certificate.title,
    packet.acs.title,
    packet.acs.area,
    packet.acs.areaTitle,
    packet.acs.task,
    packet.acs.taskTitle,
    packet.acs.elementType,
    packet.acs.elementReference,
    packet.concept.title,
    ...packet.concept.subjectTags,
    ...packet.concept.searchKeywords,
    ...packet.concept.sources.map((source) => `${source.label} ${source.reference}`),
    ...packet.variants.map((variant) => variant.prompt),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export async function upsertDpeConceptPacket(packet: DpeConceptPacket) {
  const now = new Date();
  const searchText = buildSearchText(packet);

  return getDb().transaction(async (tx) => {
    await tx
      .insert(dpeCertificateTypes)
      .values({
        active: true,
        code: packet.certificate.code,
        id: packet.certificate.id,
        title: packet.certificate.title,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          active: true,
          code: packet.certificate.code,
          title: packet.certificate.title,
          updatedAt: now,
        },
        target: dpeCertificateTypes.id,
      });

    const [contentVersion] = await tx
      .insert(dpeContentVersions)
      .values({
        certificateTypeId: packet.certificate.id,
        notes: "Concept and repeatable-question variant content.",
        status: "ready",
        title: `${packet.certificate.title} Concepts`,
        updatedAt: now,
        version: 1,
      })
      .onConflictDoUpdate({
        set: {
          notes: "Concept and repeatable-question variant content.",
          status: "ready",
          title: `${packet.certificate.title} Concepts`,
          updatedAt: now,
        },
        target: [dpeContentVersions.certificateTypeId, dpeContentVersions.version],
      })
      .returning({ id: dpeContentVersions.id });

    const [concept] = await tx
      .insert(dpeConcepts)
      .values({
        acsArea: packet.acs.area,
        acsAreaTitle: packet.acs.areaTitle,
        acsElementReference: packet.acs.elementReference,
        acsElementType: packet.acs.elementType,
        acsTask: packet.acs.task,
        acsTaskTitle: packet.acs.taskTitle,
        acsTitle: packet.acs.title,
        active: true,
        certificateTypeId: packet.certificate.id,
        contentVersionId: contentVersion.id,
        difficulty: packet.concept.difficulty,
        id: packet.concept.id,
        reviewStatus: "ready",
        searchText,
        sourceStatus: "source_verified",
        title: packet.concept.title,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          acsArea: packet.acs.area,
          acsAreaTitle: packet.acs.areaTitle,
          acsElementReference: packet.acs.elementReference,
          acsElementType: packet.acs.elementType,
          acsTask: packet.acs.task,
          acsTaskTitle: packet.acs.taskTitle,
          acsTitle: packet.acs.title,
          active: true,
          certificateTypeId: packet.certificate.id,
          contentVersionId: contentVersion.id,
          difficulty: packet.concept.difficulty,
          reviewStatus: "ready",
          searchText,
          sourceStatus: "source_verified",
          title: packet.concept.title,
          updatedAt: now,
        },
        target: dpeConcepts.id,
      })
      .returning();

    await tx.delete(dpeConceptSources).where(eq(dpeConceptSources.conceptId, concept.id));
    await tx.delete(dpeConceptTags).where(eq(dpeConceptTags.conceptId, concept.id));
    await tx.delete(dpeQuestionVariants).where(eq(dpeQuestionVariants.conceptId, concept.id));

    await tx.insert(dpeConceptSources).values(
      packet.concept.sources.map((source, index) => ({
        conceptId: concept.id,
        label: source.label,
        notes: source.notes,
        reference: source.reference,
        sortOrder: index,
        sourceUrl: source.url,
      })),
    );

    const tagRows = [];
    for (const label of packet.concept.subjectTags) {
      const slug = slugify(label);
      if (!slug) continue;
      const [tag] = await tx
        .insert(dpeSubjectTags)
        .values({ label, slug, updatedAt: now })
        .onConflictDoUpdate({
          set: { label, updatedAt: now },
          target: dpeSubjectTags.slug,
        })
        .returning({ id: dpeSubjectTags.id });
      tagRows.push({ conceptId: concept.id, tagId: tag.id });
    }

    if (tagRows.length > 0) {
      await tx.insert(dpeConceptTags).values(tagRows).onConflictDoNothing();
    }

    const variants = await tx
      .insert(dpeQuestionVariants)
      .values(
        packet.variants.map((variant, index) => ({
          acceptedAnswers: variant.acceptedAnswers,
          acceptablePhrases: variant.acceptablePhrases,
          choicesJson: variant.choices,
          commonMisses: variant.commonMisses,
          conceptId: concept.id,
          correctionIfFalse: variant.correctionIfFalse,
          correctAnswerBoolean: variant.correctAnswerBoolean,
          correctChoiceIds: variant.correctChoiceIds,
          debrief: variant.debrief,
          explanation: variant.explanation,
          expectedAnswerElements: variant.expectedAnswerElements,
          followUps: undefined,
          hintSequence: variant.hintSequence,
          idealShortAnswer: variant.idealShortAnswer,
          mode: variant.mode,
          prompt: variant.prompt,
          reviewStatus: "ready",
          rubricJson: undefined,
          scenarioSetup: undefined,
          sortOrder: index,
          teachingPoints: variant.teachingPoints,
        })),
      )
      .returning();

    return {
      concept,
      sources: packet.concept.sources.length,
      tags: tagRows.length,
      variants,
    };
  });
}

export async function listDpeConceptFilters(input: { certificateTypeId?: string } = {}) {
  const concepts = await getDb()
    .select({
      acsArea: dpeConcepts.acsArea,
      acsAreaTitle: dpeConcepts.acsAreaTitle,
      acsTask: dpeConcepts.acsTask,
      acsTaskTitle: dpeConcepts.acsTaskTitle,
      certificateTypeId: dpeConcepts.certificateTypeId,
      mode: dpeQuestionVariants.mode,
      tagLabel: dpeSubjectTags.label,
      tagSlug: dpeSubjectTags.slug,
    })
    .from(dpeConcepts)
    .innerJoin(dpeQuestionVariants, eq(dpeQuestionVariants.conceptId, dpeConcepts.id))
    .leftJoin(dpeConceptTags, eq(dpeConceptTags.conceptId, dpeConcepts.id))
    .leftJoin(dpeSubjectTags, eq(dpeSubjectTags.id, dpeConceptTags.tagId))
    .where(
      and(
        eq(dpeConcepts.active, true),
        eq(dpeConcepts.reviewStatus, "ready"),
        eq(dpeQuestionVariants.active, true),
        eq(dpeQuestionVariants.reviewStatus, "ready"),
        inArray(dpeQuestionVariants.mode, [...dpeConceptVariantModes]),
        input.certificateTypeId ? eq(dpeConcepts.certificateTypeId, input.certificateTypeId) : undefined,
      ),
    )
    .orderBy(asc(dpeConcepts.acsArea), asc(dpeConcepts.acsTask));

  const areas = new Map<string, { code: string; taskCount: number; title: string | null }>();
  const tasksByArea: Record<string, Array<{ code: string; title: string | null }>> = {};
  const tags = new Map<string, { label: string; slug: string }>();
  const modes = new Set<string>();

  for (const row of concepts) {
    modes.add(row.mode);
    const area = areas.get(row.acsArea) ?? { code: row.acsArea, taskCount: 0, title: row.acsAreaTitle };
    areas.set(row.acsArea, area);
    tasksByArea[row.acsArea] ??= [];
    if (!tasksByArea[row.acsArea].some((task) => task.code === row.acsTask)) {
      tasksByArea[row.acsArea].push({ code: row.acsTask, title: row.acsTaskTitle });
      area.taskCount += 1;
    }
    if (row.tagSlug && row.tagLabel) {
      tags.set(row.tagSlug, { label: row.tagLabel, slug: row.tagSlug });
    }
  }

  return {
    areas: [...areas.values()].sort((left, right) => left.code.localeCompare(right.code)),
    available: true,
    modes: [...modes].sort(),
    tags: [...tags.values()].sort((left, right) => left.label.localeCompare(right.label)),
    tasksByArea,
  };
}

export async function listDpeQuestionVariants(input: DpeConceptFilters = {}) {
  const tags = input.tags?.map(slugify).filter(Boolean) ?? [];
  const tagConceptIds =
    tags.length > 0
      ? await getDb()
          .select({ conceptId: dpeConceptTags.conceptId })
          .from(dpeConceptTags)
          .innerJoin(dpeSubjectTags, eq(dpeSubjectTags.id, dpeConceptTags.tagId))
          .where(inArray(dpeSubjectTags.slug, tags))
      : [];
  const allowedConceptIds = [...new Set(tagConceptIds.map((row) => row.conceptId))];

  if (tags.length > 0 && allowedConceptIds.length === 0) {
    return { available: true, variants: [] };
  }

  const rows = await getDb()
    .select({
      acsArea: dpeConcepts.acsArea,
      acsAreaTitle: dpeConcepts.acsAreaTitle,
      acsElementReference: dpeConcepts.acsElementReference,
      acsElementType: dpeConcepts.acsElementType,
      acsTask: dpeConcepts.acsTask,
      acsTaskTitle: dpeConcepts.acsTaskTitle,
      acsTitle: dpeConcepts.acsTitle,
      acceptedAnswers: dpeQuestionVariants.acceptedAnswers,
      acceptablePhrases: dpeQuestionVariants.acceptablePhrases,
      certificateCode: dpeCertificateTypes.code,
      certificateId: dpeCertificateTypes.id,
      certificateTitle: dpeCertificateTypes.title,
      choices: dpeQuestionVariants.choicesJson,
      commonMisses: dpeQuestionVariants.commonMisses,
      conceptId: dpeConcepts.id,
      conceptTitle: dpeConcepts.title,
      correctionIfFalse: dpeQuestionVariants.correctionIfFalse,
      correctAnswerBoolean: dpeQuestionVariants.correctAnswerBoolean,
      correctChoiceIds: dpeQuestionVariants.correctChoiceIds,
      debrief: dpeQuestionVariants.debrief,
      difficulty: dpeConcepts.difficulty,
      explanation: dpeQuestionVariants.explanation,
      expectedAnswerElements: dpeQuestionVariants.expectedAnswerElements,
      followUps: dpeQuestionVariants.followUps,
      hintSequence: dpeQuestionVariants.hintSequence,
      idealShortAnswer: dpeQuestionVariants.idealShortAnswer,
      mode: dpeQuestionVariants.mode,
      prompt: dpeQuestionVariants.prompt,
      rubric: dpeQuestionVariants.rubricJson,
      scenarioSetup: dpeQuestionVariants.scenarioSetup,
      teachingPoints: dpeQuestionVariants.teachingPoints,
      variantId: dpeQuestionVariants.id,
    })
    .from(dpeQuestionVariants)
    .innerJoin(dpeConcepts, eq(dpeConcepts.id, dpeQuestionVariants.conceptId))
    .innerJoin(dpeCertificateTypes, eq(dpeCertificateTypes.id, dpeConcepts.certificateTypeId))
    .where(
      and(
        eq(dpeConcepts.active, true),
        eq(dpeConcepts.reviewStatus, "ready"),
        eq(dpeQuestionVariants.active, true),
        eq(dpeQuestionVariants.reviewStatus, "ready"),
        inArray(dpeQuestionVariants.mode, [...dpeConceptVariantModes]),
        input.certificateTypeId ? eq(dpeConcepts.certificateTypeId, input.certificateTypeId) : undefined,
        input.acsArea ? eq(dpeConcepts.acsArea, input.acsArea) : undefined,
        input.acsTask ? eq(dpeConcepts.acsTask, input.acsTask) : undefined,
        input.mode ? eq(dpeQuestionVariants.mode, input.mode) : undefined,
        input.query ? ilike(dpeConcepts.searchText, `%${input.query.toLowerCase()}%`) : undefined,
        allowedConceptIds.length > 0 ? inArray(dpeConcepts.id, allowedConceptIds) : undefined,
      ),
    )
    .orderBy(asc(dpeConcepts.acsArea), asc(dpeConcepts.acsTask), asc(dpeQuestionVariants.sortOrder));

  return {
    available: true,
    variants: rows.map((row) => ({
      acs: {
        area: row.acsArea,
        areaTitle: row.acsAreaTitle,
        elementReference: row.acsElementReference,
        elementType: row.acsElementType,
        task: row.acsTask,
        taskTitle: row.acsTaskTitle,
        title: row.acsTitle,
      },
      acceptedAnswers: row.acceptedAnswers ?? undefined,
      acceptablePhrases: row.acceptablePhrases ?? undefined,
      certificate: {
        code: row.certificateCode,
        id: row.certificateId,
        title: row.certificateTitle,
      },
      choices: row.choices ?? undefined,
      commonMisses: row.commonMisses ?? undefined,
      concept: {
        difficulty: row.difficulty,
        id: row.conceptId,
        title: row.conceptTitle,
      },
      correctionIfFalse: row.correctionIfFalse ?? undefined,
      correctAnswerBoolean: row.correctAnswerBoolean ?? undefined,
      correctChoiceIds: row.correctChoiceIds ?? undefined,
      debrief: row.debrief ?? undefined,
      explanation: row.explanation ?? undefined,
      expectedAnswerElements: row.expectedAnswerElements ?? undefined,
      followUps: row.followUps ?? undefined,
      hintSequence: row.hintSequence ?? undefined,
      idealShortAnswer: row.idealShortAnswer ?? undefined,
      mode: row.mode,
      prompt: row.prompt,
      rubric: row.rubric ?? undefined,
      scenarioSetup: row.scenarioSetup ?? undefined,
      teachingPoints: row.teachingPoints ?? undefined,
      variantId: row.variantId,
    })),
  };
}

export async function countReadyDpeConceptVariants() {
  const [result] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(dpeQuestionVariants)
    .innerJoin(dpeConcepts, eq(dpeConcepts.id, dpeQuestionVariants.conceptId))
    .where(
      and(
        eq(dpeConcepts.active, true),
        eq(dpeConcepts.reviewStatus, "ready"),
        eq(dpeQuestionVariants.active, true),
        eq(dpeQuestionVariants.reviewStatus, "ready"),
        inArray(dpeQuestionVariants.mode, [...dpeConceptVariantModes]),
      ),
    );

  return result?.count ?? 0;
}
