import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  dpeMockOralBlueprints,
  dpeScenarioCases,
  dpeScenarioCheckpoints,
  dpeScenarioSteps,
  dpeStimulusAssets,
  dpeStimulusLinks,
  dpeStimulusPackets,
} from "@/server/db/schema";

type ValidationResult<T> = { ok: true; value: T } | { error: string; ok: false };

type StimulusAssetInput = {
  instructions: string | null;
  label: string;
  metadata: Record<string, unknown> | null;
  storageKey: string | null;
  textContent: string | null;
  transcript: string | null;
  type: "audio" | "chart" | "document" | "image" | "metar_taf" | "other" | "text";
  url: string | null;
};

type StimulusLinkInput = {
  requiredToAnswer: boolean;
  targetId: string;
  targetType: "concept" | "drill_variant" | "mock_oral_blueprint" | "scenario_case" | "scenario_step";
  usage: string | null;
};

export type DpeStimulusPacketInput = {
  active: boolean;
  aiContext: string;
  assetType: string;
  assets: StimulusAssetInput[];
  certificateTypeId: string | null;
  commonMisreads: string[];
  displayTitle: string;
  id: string;
  interpretationNotes: string[];
  keyDetails: string[];
  learnerDescription: string;
  links: StimulusLinkInput[];
  reviewStatus: string;
  sourceLabel: string;
  sourceReference: string;
  sourceUrl: string | null;
};

type ScenarioCheckpointInput = {
  aiEvaluationNotes: string;
  conceptIds: string[];
  expectedAnswerElements: string[];
  prompt: string;
  stimulusPacketIds: string[];
};

type ScenarioStepInput = {
  aiPrompt: string;
  checkpoints: ScenarioCheckpointInput[];
  conceptIds: string[];
  expectedPilotActions: string[];
  riskPoints: string[];
  scenarioText: string;
  stimulusPacketIds: string[];
  title: string;
};

export type DpeScenarioCaseInput = {
  active: boolean;
  aiInstructions: string;
  certificateTypeId: string | null;
  id: string;
  reviewStatus: string;
  steps: ScenarioStepInput[];
  summary: string;
  title: string;
};

export type DpeMockOralBlueprintInput = {
  active: boolean;
  aiInstructions: string;
  certificateTypeId: string | null;
  conceptPool: string[];
  coveragePolicy: Record<string, unknown>;
  durationMinutes: number | null;
  examinerStyle: string;
  id: string;
  reviewStatus: string;
  scenarioPool: string[];
  sessionMode: string;
  stimulusPacketIds: string[];
  title: string;
};

const maxTextLength = 12000;
const allowedReviewStatuses = new Set(["draft", "review", "ready"]);
const allowedAssetTypes = new Set([
  "audio",
  "chart",
  "document",
  "image",
  "metar_taf",
  "other",
  "text",
]);
const allowedStimulusLinkTargets = new Set([
  "concept",
  "drill_variant",
  "mock_oral_blueprint",
  "scenario_case",
  "scenario_step",
]);

function objectValue(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: `${field} must be an object.`, ok: false as const };
  }

  return { ok: true as const, value: value as Record<string, unknown> };
}

function wrappedObjectValue(value: unknown, wrapperKey: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: `${wrapperKey} must be an object.`, ok: false as const };
  }

  const candidate = value as Record<string, unknown>;
  return objectValue(candidate[wrapperKey] ?? value, wrapperKey);
}

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

function cleanStringList(value: unknown, field: string, required = false, maxItems = 80) {
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

function cleanReviewStatus(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: "draft" };
  }

  if (typeof value !== "string" || !allowedReviewStatuses.has(value)) {
    return { error: "reviewStatus must be draft, review, or ready.", ok: false as const };
  }

  return { ok: true as const, value };
}

function cleanOptionalObject(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return { ok: true as const, value: null };
  }

  const object = objectValue(value, field);
  if (!object.ok) return object;
  return { ok: true as const, value: object.value };
}

function cleanCoveragePolicy(value: unknown) {
  const object = objectValue(value, "coveragePolicy");
  if (!object.ok) return object;
  if (Object.keys(object.value).length === 0) {
    return { error: "coveragePolicy must include at least one coverage rule.", ok: false as const };
  }

  return { ok: true as const, value: object.value };
}

function parseAssets(value: unknown): ValidationResult<StimulusAssetInput[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "assets requires at least one display asset.", ok: false };
  }

  const assets: StimulusAssetInput[] = [];
  for (const [index, rawAsset] of value.entries()) {
    const asset = objectValue(rawAsset, `assets[${index}]`);
    if (!asset.ok) return asset;
    const type = cleanText(asset.value.type, `assets[${index}].type`, 80);
    const label = cleanText(asset.value.label, `assets[${index}].label`, 300);
    const url = cleanOptionalText(asset.value.url, `assets[${index}].url`, 1000);
    const storageKey = cleanOptionalText(asset.value.storageKey, `assets[${index}].storageKey`, 1000);
    const textContent = cleanOptionalText(asset.value.textContent, `assets[${index}].textContent`);
    const transcript = cleanOptionalText(asset.value.transcript, `assets[${index}].transcript`);
    const instructions = cleanOptionalText(asset.value.instructions, `assets[${index}].instructions`);
    const metadata = cleanOptionalObject(asset.value.metadata, `assets[${index}].metadata`);
    if (!type.ok) return type;
    if (!allowedAssetTypes.has(type.value)) {
      return { error: `assets[${index}].type is not supported.`, ok: false };
    }
    if (!label.ok) return label;
    if (!url.ok) return url;
    if (!storageKey.ok) return storageKey;
    if (!textContent.ok) return textContent;
    if (!transcript.ok) return transcript;
    if (!instructions.ok) return instructions;
    if (!metadata.ok) return metadata;
    assets.push({
      instructions: instructions.value,
      label: label.value,
      metadata: metadata.value,
      storageKey: storageKey.value,
      textContent: textContent.value,
      transcript: transcript.value,
      type: type.value as StimulusAssetInput["type"],
      url: url.value,
    });
  }

  return { ok: true, value: assets };
}

function parseStimulusLinks(value: unknown): ValidationResult<StimulusLinkInput[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { error: "links must be a list.", ok: false };

  const links: StimulusLinkInput[] = [];
  for (const [index, rawLink] of value.entries()) {
    const link = objectValue(rawLink, `links[${index}]`);
    if (!link.ok) return link;
    const targetType = cleanText(link.value.targetType, `links[${index}].targetType`, 80);
    const targetId = cleanText(link.value.targetId, `links[${index}].targetId`, 200);
    const usage = cleanOptionalText(link.value.usage, `links[${index}].usage`, 1000);
    if (!targetType.ok) return targetType;
    if (!allowedStimulusLinkTargets.has(targetType.value)) {
      return { error: `links[${index}].targetType is not supported.`, ok: false };
    }
    if (!targetId.ok) return targetId;
    if (!usage.ok) return usage;
    links.push({
      requiredToAnswer: link.value.requiredToAnswer === true,
      targetId: targetId.value,
      targetType: targetType.value as StimulusLinkInput["targetType"],
      usage: usage.value,
    });
  }

  return { ok: true, value: links };
}

export function parseDpeStimulusPacket(body: unknown): ValidationResult<DpeStimulusPacketInput> {
  const root = wrappedObjectValue(body, "stimulusPacket");
  if (!root.ok) return root;

  const id = cleanText(root.value.id, "id", 180);
  const certificateTypeId = cleanOptionalText(root.value.certificateTypeId, "certificateTypeId", 120);
  const displayTitle = cleanText(root.value.displayTitle, "displayTitle", 300);
  const assetType = cleanText(root.value.assetType, "assetType", 100);
  const learnerDescription = cleanText(root.value.learnerDescription, "learnerDescription");
  const aiContext = cleanText(root.value.aiContext, "aiContext");
  const keyDetails = cleanStringList(root.value.keyDetails, "keyDetails", true);
  const interpretationNotes = cleanStringList(root.value.interpretationNotes, "interpretationNotes", true);
  const commonMisreads = cleanStringList(root.value.commonMisreads, "commonMisreads");
  const sourceLabel = cleanText(root.value.sourceLabel, "sourceLabel", 300);
  const sourceReference = cleanText(root.value.sourceReference, "sourceReference", 1000);
  const sourceUrl = cleanOptionalText(root.value.sourceUrl, "sourceUrl", 1000);
  const reviewStatus = cleanReviewStatus(root.value.reviewStatus);
  const assets = parseAssets(root.value.assets);
  const links = parseStimulusLinks(root.value.links);

  if (!id.ok) return id;
  if (!certificateTypeId.ok) return certificateTypeId;
  if (!displayTitle.ok) return displayTitle;
  if (!assetType.ok) return assetType;
  if (!learnerDescription.ok) return learnerDescription;
  if (!aiContext.ok) return aiContext;
  if (!keyDetails.ok) return keyDetails;
  if (!interpretationNotes.ok) return interpretationNotes;
  if (!commonMisreads.ok) return commonMisreads;
  if (!sourceLabel.ok) return sourceLabel;
  if (!sourceReference.ok) return sourceReference;
  if (!sourceUrl.ok) return sourceUrl;
  if (!reviewStatus.ok) return reviewStatus;
  if (!assets.ok) return assets;
  if (!links.ok) return links;

  return {
    ok: true,
    value: {
      active: root.value.active !== false,
      aiContext: aiContext.value,
      assetType: assetType.value,
      assets: assets.value,
      certificateTypeId: certificateTypeId.value,
      commonMisreads: commonMisreads.value,
      displayTitle: displayTitle.value,
      id: id.value,
      interpretationNotes: interpretationNotes.value,
      keyDetails: keyDetails.value,
      learnerDescription: learnerDescription.value,
      links: links.value,
      reviewStatus: reviewStatus.value,
      sourceLabel: sourceLabel.value,
      sourceReference: sourceReference.value,
      sourceUrl: sourceUrl.value,
    },
  };
}

function parseScenarioCheckpoints(value: unknown, field: string): ValidationResult<ScenarioCheckpointInput[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: `${field} requires at least one checkpoint.`, ok: false };
  }

  const checkpoints: ScenarioCheckpointInput[] = [];
  for (const [index, rawCheckpoint] of value.entries()) {
    const checkpoint = objectValue(rawCheckpoint, `${field}[${index}]`);
    if (!checkpoint.ok) return checkpoint;
    const prompt = cleanText(checkpoint.value.prompt, `${field}[${index}].prompt`);
    const expectedAnswerElements = cleanStringList(
      checkpoint.value.expectedAnswerElements,
      `${field}[${index}].expectedAnswerElements`,
      true,
    );
    const aiEvaluationNotes = cleanText(
      checkpoint.value.aiEvaluationNotes,
      `${field}[${index}].aiEvaluationNotes`,
    );
    const conceptIds = cleanStringList(checkpoint.value.conceptIds, `${field}[${index}].conceptIds`);
    const stimulusPacketIds = cleanStringList(
      checkpoint.value.stimulusPacketIds,
      `${field}[${index}].stimulusPacketIds`,
    );
    if (!prompt.ok) return prompt;
    if (!expectedAnswerElements.ok) return expectedAnswerElements;
    if (!aiEvaluationNotes.ok) return aiEvaluationNotes;
    if (!conceptIds.ok) return conceptIds;
    if (!stimulusPacketIds.ok) return stimulusPacketIds;
    checkpoints.push({
      aiEvaluationNotes: aiEvaluationNotes.value,
      conceptIds: conceptIds.value,
      expectedAnswerElements: expectedAnswerElements.value,
      prompt: prompt.value,
      stimulusPacketIds: stimulusPacketIds.value,
    });
  }

  return { ok: true, value: checkpoints };
}

function parseScenarioSteps(value: unknown): ValidationResult<ScenarioStepInput[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "steps requires at least one scenario step.", ok: false };
  }

  const steps: ScenarioStepInput[] = [];
  for (const [index, rawStep] of value.entries()) {
    const step = objectValue(rawStep, `steps[${index}]`);
    if (!step.ok) return step;
    const title = cleanText(step.value.title, `steps[${index}].title`, 300);
    const scenarioText = cleanText(step.value.scenarioText, `steps[${index}].scenarioText`);
    const aiPrompt = cleanText(step.value.aiPrompt, `steps[${index}].aiPrompt`);
    const expectedPilotActions = cleanStringList(
      step.value.expectedPilotActions,
      `steps[${index}].expectedPilotActions`,
      true,
    );
    const riskPoints = cleanStringList(step.value.riskPoints, `steps[${index}].riskPoints`);
    const conceptIds = cleanStringList(step.value.conceptIds, `steps[${index}].conceptIds`);
    const stimulusPacketIds = cleanStringList(
      step.value.stimulusPacketIds,
      `steps[${index}].stimulusPacketIds`,
    );
    const checkpoints = parseScenarioCheckpoints(step.value.checkpoints, `steps[${index}].checkpoints`);
    if (!title.ok) return title;
    if (!scenarioText.ok) return scenarioText;
    if (!aiPrompt.ok) return aiPrompt;
    if (!expectedPilotActions.ok) return expectedPilotActions;
    if (!riskPoints.ok) return riskPoints;
    if (!conceptIds.ok) return conceptIds;
    if (!stimulusPacketIds.ok) return stimulusPacketIds;
    if (!checkpoints.ok) return checkpoints;
    steps.push({
      aiPrompt: aiPrompt.value,
      checkpoints: checkpoints.value,
      conceptIds: conceptIds.value,
      expectedPilotActions: expectedPilotActions.value,
      riskPoints: riskPoints.value,
      scenarioText: scenarioText.value,
      stimulusPacketIds: stimulusPacketIds.value,
      title: title.value,
    });
  }

  return { ok: true, value: steps };
}

export function parseDpeScenarioCase(body: unknown): ValidationResult<DpeScenarioCaseInput> {
  const root = wrappedObjectValue(body, "scenarioCase");
  if (!root.ok) return root;
  const id = cleanText(root.value.id, "id", 180);
  const certificateTypeId = cleanOptionalText(root.value.certificateTypeId, "certificateTypeId", 120);
  const title = cleanText(root.value.title, "title", 300);
  const summary = cleanText(root.value.summary, "summary");
  const aiInstructions = cleanText(root.value.aiInstructions, "aiInstructions");
  const reviewStatus = cleanReviewStatus(root.value.reviewStatus);
  const steps = parseScenarioSteps(root.value.steps);
  if (!id.ok) return id;
  if (!certificateTypeId.ok) return certificateTypeId;
  if (!title.ok) return title;
  if (!summary.ok) return summary;
  if (!aiInstructions.ok) return aiInstructions;
  if (!reviewStatus.ok) return reviewStatus;
  if (!steps.ok) return steps;

  return {
    ok: true,
    value: {
      active: root.value.active !== false,
      aiInstructions: aiInstructions.value,
      certificateTypeId: certificateTypeId.value,
      id: id.value,
      reviewStatus: reviewStatus.value,
      steps: steps.value,
      summary: summary.value,
      title: title.value,
    },
  };
}

export function parseDpeMockOralBlueprint(body: unknown): ValidationResult<DpeMockOralBlueprintInput> {
  const root = wrappedObjectValue(body, "mockOralBlueprint");
  if (!root.ok) return root;
  const id = cleanText(root.value.id, "id", 180);
  const certificateTypeId = cleanOptionalText(root.value.certificateTypeId, "certificateTypeId", 120);
  const title = cleanText(root.value.title, "title", 300);
  const sessionMode = cleanText(root.value.sessionMode ?? "voice", "sessionMode", 80);
  const coveragePolicy = cleanCoveragePolicy(root.value.coveragePolicy);
  const examinerStyle = cleanText(root.value.examinerStyle, "examinerStyle");
  const aiInstructions = cleanText(root.value.aiInstructions, "aiInstructions");
  const conceptPool = cleanStringList(root.value.conceptPool, "conceptPool");
  const scenarioPool = cleanStringList(root.value.scenarioPool, "scenarioPool");
  const stimulusPacketIds = cleanStringList(root.value.stimulusPacketIds, "stimulusPacketIds");
  const reviewStatus = cleanReviewStatus(root.value.reviewStatus);
  if (!id.ok) return id;
  if (!certificateTypeId.ok) return certificateTypeId;
  if (!title.ok) return title;
  if (!sessionMode.ok) return sessionMode;
  if (!coveragePolicy.ok) return coveragePolicy;
  if (!examinerStyle.ok) return examinerStyle;
  if (!aiInstructions.ok) return aiInstructions;
  if (!conceptPool.ok) return conceptPool;
  if (!scenarioPool.ok) return scenarioPool;
  if (!stimulusPacketIds.ok) return stimulusPacketIds;
  if (!reviewStatus.ok) return reviewStatus;
  const durationMinutes =
    typeof root.value.durationMinutes === "number" && Number.isFinite(root.value.durationMinutes)
      ? Math.max(1, Math.round(root.value.durationMinutes))
      : null;

  return {
    ok: true,
    value: {
      active: root.value.active !== false,
      aiInstructions: aiInstructions.value,
      certificateTypeId: certificateTypeId.value,
      conceptPool: conceptPool.value,
      coveragePolicy: coveragePolicy.value,
      durationMinutes,
      examinerStyle: examinerStyle.value,
      id: id.value,
      reviewStatus: reviewStatus.value,
      scenarioPool: scenarioPool.value,
      sessionMode: sessionMode.value,
      stimulusPacketIds: stimulusPacketIds.value,
      title: title.value,
    },
  };
}

export async function upsertDpeStimulusPacket(input: DpeStimulusPacketInput) {
  const now = new Date();
  const packetValues = {
    active: input.active,
    aiContext: input.aiContext,
    assetType: input.assetType,
    certificateTypeId: input.certificateTypeId,
    commonMisreads: input.commonMisreads,
    displayTitle: input.displayTitle,
    id: input.id,
    interpretationNotes: input.interpretationNotes,
    keyDetails: input.keyDetails,
    learnerDescription: input.learnerDescription,
    reviewStatus: input.reviewStatus,
    sourceLabel: input.sourceLabel,
    sourceReference: input.sourceReference,
    sourceUrl: input.sourceUrl,
    updatedAt: now,
  };

  return getDb().transaction(async (tx) => {
    const [packet] = await tx
      .insert(dpeStimulusPackets)
      .values(packetValues)
      .onConflictDoUpdate({
        set: packetValues,
        target: dpeStimulusPackets.id,
      })
      .returning();

    await tx.delete(dpeStimulusAssets).where(eq(dpeStimulusAssets.stimulusPacketId, input.id));
    await tx.delete(dpeStimulusLinks).where(eq(dpeStimulusLinks.stimulusPacketId, input.id));

    if (input.assets.length > 0) {
      await tx.insert(dpeStimulusAssets).values(
        input.assets.map((asset, index) => ({
          ...asset,
          sortOrder: index,
          stimulusPacketId: input.id,
        })),
      );
    }

    if (input.links.length > 0) {
      await tx.insert(dpeStimulusLinks).values(
        input.links.map((link, index) => ({
          ...link,
          sortOrder: index,
          stimulusPacketId: input.id,
        })),
      );
    }

    return { assets: input.assets.length, links: input.links.length, packet };
  });
}

export async function upsertDpeScenarioCase(input: DpeScenarioCaseInput) {
  const now = new Date();

  return getDb().transaction(async (tx) => {
    const [scenario] = await tx
      .insert(dpeScenarioCases)
      .values({
        active: input.active,
        aiInstructions: input.aiInstructions,
        certificateTypeId: input.certificateTypeId,
        id: input.id,
        reviewStatus: input.reviewStatus,
        summary: input.summary,
        title: input.title,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        set: {
          active: input.active,
          aiInstructions: input.aiInstructions,
          certificateTypeId: input.certificateTypeId,
          reviewStatus: input.reviewStatus,
          summary: input.summary,
          title: input.title,
          updatedAt: now,
        },
        target: dpeScenarioCases.id,
      })
      .returning();

    await tx.delete(dpeScenarioSteps).where(eq(dpeScenarioSteps.scenarioCaseId, input.id));

    let checkpoints = 0;
    for (const [stepIndex, step] of input.steps.entries()) {
      const [savedStep] = await tx
        .insert(dpeScenarioSteps)
        .values({
          aiPrompt: step.aiPrompt,
          conceptIds: step.conceptIds,
          expectedPilotActions: step.expectedPilotActions,
          riskPoints: step.riskPoints,
          scenarioCaseId: input.id,
          scenarioText: step.scenarioText,
          sortOrder: stepIndex,
          stimulusPacketIds: step.stimulusPacketIds,
          title: step.title,
        })
        .returning({ id: dpeScenarioSteps.id });

      await tx.insert(dpeScenarioCheckpoints).values(
        step.checkpoints.map((checkpoint, checkpointIndex) => ({
          aiEvaluationNotes: checkpoint.aiEvaluationNotes,
          conceptIds: checkpoint.conceptIds,
          expectedAnswerElements: checkpoint.expectedAnswerElements,
          prompt: checkpoint.prompt,
          scenarioStepId: savedStep.id,
          sortOrder: checkpointIndex,
          stimulusPacketIds: checkpoint.stimulusPacketIds,
        })),
      );
      checkpoints += step.checkpoints.length;
    }

    return { checkpoints, scenario, steps: input.steps.length };
  });
}

export async function upsertDpeMockOralBlueprint(input: DpeMockOralBlueprintInput) {
  const now = new Date();
  const [blueprint] = await getDb()
    .insert(dpeMockOralBlueprints)
    .values({ ...input, updatedAt: now })
    .onConflictDoUpdate({
      set: { ...input, updatedAt: now },
      target: dpeMockOralBlueprints.id,
    })
    .returning();

  return blueprint;
}

export async function listDpeStimulusPackets(input: { certificateTypeId?: string } = {}) {
  const packets = await getDb()
    .select()
    .from(dpeStimulusPackets)
    .where(
      and(
        eq(dpeStimulusPackets.active, true),
        input.certificateTypeId
          ? eq(dpeStimulusPackets.certificateTypeId, input.certificateTypeId)
          : undefined,
      ),
    )
    .orderBy(asc(dpeStimulusPackets.displayTitle));

  const packetIds = packets.map((packet) => packet.id);
  const assets =
    packetIds.length > 0
      ? await getDb()
          .select()
          .from(dpeStimulusAssets)
          .where(inArray(dpeStimulusAssets.stimulusPacketId, packetIds))
          .orderBy(asc(dpeStimulusAssets.sortOrder))
      : [];
  const links =
    packetIds.length > 0
      ? await getDb()
          .select()
          .from(dpeStimulusLinks)
          .where(inArray(dpeStimulusLinks.stimulusPacketId, packetIds))
          .orderBy(asc(dpeStimulusLinks.sortOrder))
      : [];

  return {
    available: true,
    stimuli: packets.map((packet) => ({
      ...packet,
      assets: assets.filter((asset) => asset.stimulusPacketId === packet.id),
      links: links.filter((link) => link.stimulusPacketId === packet.id),
    })),
  };
}

export async function listDpeScenarioCases(input: { certificateTypeId?: string } = {}) {
  const cases = await getDb()
    .select()
    .from(dpeScenarioCases)
    .where(
      and(
        eq(dpeScenarioCases.active, true),
        input.certificateTypeId ? eq(dpeScenarioCases.certificateTypeId, input.certificateTypeId) : undefined,
      ),
    )
    .orderBy(asc(dpeScenarioCases.title));

  const caseIds = cases.map((scenario) => scenario.id);
  const steps =
    caseIds.length > 0
      ? await getDb()
          .select()
          .from(dpeScenarioSteps)
          .where(inArray(dpeScenarioSteps.scenarioCaseId, caseIds))
          .orderBy(asc(dpeScenarioSteps.scenarioCaseId), asc(dpeScenarioSteps.sortOrder))
      : [];
  const stepIds = steps.map((step) => step.id);
  const checkpoints =
    stepIds.length > 0
      ? await getDb()
          .select()
          .from(dpeScenarioCheckpoints)
          .where(inArray(dpeScenarioCheckpoints.scenarioStepId, stepIds))
          .orderBy(asc(dpeScenarioCheckpoints.scenarioStepId), asc(dpeScenarioCheckpoints.sortOrder))
      : [];

  return {
    available: true,
    scenarios: cases.map((scenario) => ({
      ...scenario,
      steps: steps
        .filter((step) => step.scenarioCaseId === scenario.id)
        .map((step) => ({
          ...step,
          checkpoints: checkpoints.filter((checkpoint) => checkpoint.scenarioStepId === step.id),
        })),
    })),
  };
}

export async function listDpeMockOralBlueprints(input: { certificateTypeId?: string } = {}) {
  const blueprints = await getDb()
    .select()
    .from(dpeMockOralBlueprints)
    .where(
      and(
        eq(dpeMockOralBlueprints.active, true),
        input.certificateTypeId
          ? eq(dpeMockOralBlueprints.certificateTypeId, input.certificateTypeId)
          : undefined,
      ),
    )
    .orderBy(asc(dpeMockOralBlueprints.title));

  return { available: true, blueprints };
}
