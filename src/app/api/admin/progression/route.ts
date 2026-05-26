import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  listAdminProgressionSummaries,
  listProgressionEvents,
  listProgressionLevelThresholds,
  listProgressionQuests,
  saveProgressionLevelThreshold,
  saveProgressionQuest,
} from "@/server/progression/progression";
import type { QuestCheckType } from "@/product/interview-types";

export const runtime = "nodejs";

const questCheckTypes: QuestCheckType[] = [
  "session_count",
  "mode_used",
  "all_modes_used",
  "debrief_count",
  "resume_uploaded",
  "job_target_set",
  "streak_count",
  "question_type_used",
  "all_question_types_used",
  "single_score_min",
  "all_scores_min",
  "avg_score_min",
  "level_reached",
];

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const [summaries, events, levels, quests] = await Promise.all([
      listAdminProgressionSummaries(100),
      listProgressionEvents(100),
      listProgressionLevelThresholds(),
      listProgressionQuests(),
    ]);

    return NextResponse.json({ events, levels, quests, summaries });
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
  };

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
