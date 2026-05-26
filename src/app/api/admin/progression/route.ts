import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  listAdminProgressionSummaries,
  listProgressionEvents,
  listProgressionLevelThresholds,
  saveProgressionLevelThreshold,
} from "@/server/progression/progression";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const [summaries, events, levels] = await Promise.all([
      listAdminProgressionSummaries(100),
      listProgressionEvents(100),
      listProgressionLevelThresholds(),
    ]);

    return NextResponse.json({ events, levels, summaries });
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
    level?: unknown;
    minTotalXp?: unknown;
    name?: unknown;
  };
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
