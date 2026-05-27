import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  listAdminProgressionSummaries,
  listProgressionEvents,
  listProgressionLevelThresholds,
  listProgressionQuests,
  listProgressionXpRules,
  saveProgressionLevelThreshold,
  saveProgressionQuest,
  saveProgressionXpRule,
} from "@/server/progression/progression";
import type {
  QuestCheckType,
  XpRuleAwardMode,
  XpRuleConditionType,
  XpRuleEventType,
} from "@/product/interview-types";

export const runtime = "nodejs";

const questCheckTypes: QuestCheckType[] = [
  "session_count",
  "mode_used",
  "all_modes_used",
  "debrief_count",
  "introduction_count",
  "resume_uploaded",
  "job_target_set",
  "streak_count",
  "question_type_used",
  "all_question_types_used",
  "single_score_min",
  "all_scores_min",
  "avg_score_min",
  "level_reached",
  "story_count",
];

const xpRuleEventTypes: XpRuleEventType[] = [
  "debrief_completed",
  "resume_uploaded",
  "review_completed",
];
const xpRuleConditionTypes: XpRuleConditionType[] = [
  "always",
  "debrief_created",
  "duration_min_seconds",
  "first_practice_of_day",
  "overall_score_min",
  "resume_uploaded",
];
const xpRuleAwardModes: XpRuleAwardMode[] = ["highest_only", "stack"];

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const [summaries, events, levels, quests, xpRules] = await Promise.all([
      listAdminProgressionSummaries(100),
      listProgressionEvents(100),
      listProgressionLevelThresholds(),
      listProgressionQuests(),
      listProgressionXpRules(),
    ]);

    return NextResponse.json({ events, levels, quests, summaries, xpRules });
  } catch (error) {
    console.error("Progression admin load failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load progression.",
        error: "Progression could not be loaded.",
      },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    category?: unknown;
    checkDimension?: unknown;
    checkThreshold?: unknown;
    checkType?: unknown;
    description?: unknown;
    displayOrder?: unknown;
    enabled?: unknown;
    kind?: unknown;
    level?: unknown;
    minTotalXp?: unknown;
    name?: unknown;
    questKey?: unknown;
    title?: unknown;
    xpReward?: unknown;
    active?: unknown;
    awardMode?: unknown;
    conditionType?: unknown;
    conditionValue?: unknown;
    eventType?: unknown;
    groupKey?: unknown;
    key?: unknown;
    label?: unknown;
    xp?: unknown;
  };

  if (body.kind === "xp_rule") {
    const key =
      typeof body.key === "string"
        ? body.key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80)
        : "";
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
    const eventType =
      typeof body.eventType === "string" &&
      xpRuleEventTypes.includes(body.eventType as XpRuleEventType)
        ? (body.eventType as XpRuleEventType)
        : undefined;
    const conditionType =
      typeof body.conditionType === "string" &&
      xpRuleConditionTypes.includes(body.conditionType as XpRuleConditionType)
        ? (body.conditionType as XpRuleConditionType)
        : undefined;
    const awardMode =
      typeof body.awardMode === "string" &&
      xpRuleAwardModes.includes(body.awardMode as XpRuleAwardMode)
        ? (body.awardMode as XpRuleAwardMode)
        : undefined;
    const conditionValue =
      typeof body.conditionValue === "number" ? Math.trunc(body.conditionValue) : undefined;
    const displayOrder =
      typeof body.displayOrder === "number" ? Math.trunc(body.displayOrder) : undefined;
    const xp = typeof body.xp === "number" ? Math.trunc(body.xp) : undefined;
    const groupKey =
      typeof body.groupKey === "string"
        ? body.groupKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80)
        : "general";
    const active = typeof body.active === "boolean" ? body.active : true;

    if (
      !key ||
      !label ||
      !description ||
      !eventType ||
      !conditionType ||
      !awardMode ||
      conditionValue === undefined ||
      conditionValue < 0 ||
      displayOrder === undefined ||
      xp === undefined ||
      xp < 0
    ) {
      return NextResponse.json(
        { error: "XP rule key, label, description, event, condition, order, and XP are required." },
        { status: 400 },
      );
    }

    try {
      const xpRule = await saveProgressionXpRule({
        active,
        awardMode,
        conditionType,
        conditionValue,
        description,
        displayOrder,
        eventType,
        groupKey,
        key,
        label,
        xp,
      });

      return NextResponse.json({ xpRule });
    } catch (error) {
      console.error("Progression XP rule save failed.", error);

      return NextResponse.json(
        {
          detail: "The database could not save this XP rule.",
          error: "XP rule could not be saved.",
        },
        { status: 503 },
      );
    }
  }

  if (body.kind === "quest") {
    const questKey =
      typeof body.questKey === "string"
        ? body.questKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80)
        : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const description =
      typeof body.description === "string" ? body.description.trim().slice(0, 240) : "";
    const category =
      typeof body.category === "string" ? body.category.trim().slice(0, 40) : "milestone";
    const checkType =
      typeof body.checkType === "string" &&
      questCheckTypes.includes(body.checkType as QuestCheckType)
        ? (body.checkType as QuestCheckType)
        : undefined;
    const checkDimension =
      typeof body.checkDimension === "string"
        ? body.checkDimension.trim().slice(0, 80)
        : undefined;
    const checkThreshold =
      typeof body.checkThreshold === "number" ? Math.trunc(body.checkThreshold) : undefined;
    const displayOrder =
      typeof body.displayOrder === "number" ? Math.trunc(body.displayOrder) : undefined;
    const xpReward =
      typeof body.xpReward === "number" ? Math.trunc(body.xpReward) : undefined;
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

    if (
      !questKey ||
      !title ||
      !description ||
      !checkType ||
      !checkThreshold ||
      checkThreshold < 1 ||
      displayOrder === undefined ||
      xpReward === undefined ||
      xpReward < 0
    ) {
      return NextResponse.json(
        { error: "Quest key, title, description, check, threshold, order, and XP are required." },
        { status: 400 },
      );
    }

    try {
      const quest = await saveProgressionQuest({
        category,
        checkDimension,
        checkThreshold,
        checkType,
        description,
        displayOrder,
        enabled,
        questKey,
        title,
        xpReward,
      });

      return NextResponse.json({ quest });
    } catch (error) {
      console.error("Progression quest save failed.", error);

      return NextResponse.json(
        {
          detail: "The database could not save this quest.",
          error: "Quest could not be saved.",
        },
        { status: 503 },
      );
    }
  }

  const level = typeof body.level === "number" ? Math.trunc(body.level) : undefined;
  const minTotalXp =
    typeof body.minTotalXp === "number" ? Math.trunc(body.minTotalXp) : undefined;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  if (!level || level < 1 || minTotalXp === undefined || minTotalXp < 0 || !name) {
    return NextResponse.json(
      { error: "Level, name, and minimum XP are required." },
      { status: 400 },
    );
  }

  try {
    const threshold = await saveProgressionLevelThreshold({
      level,
      minTotalXp,
      name,
    });

    return NextResponse.json({ threshold });
  } catch (error) {
    console.error("Progression level save failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not save this progression level.",
        error: "Progression level could not be saved.",
      },
      { status: 503 },
    );
  }
}
