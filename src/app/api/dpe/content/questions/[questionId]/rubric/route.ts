import { NextResponse } from "next/server";

import {
  parseDpeRubricDraft,
  upsertDpeRubric,
} from "@/server/dpe/content-admin";
import { requireAdminSession } from "@/server/admin";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const parsed = parseDpeRubricDraft(await request.json());

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { questionId } = await context.params;

  try {
    const rubric = await upsertDpeRubric(decodeURIComponent(questionId), parsed.value);

    return NextResponse.json({
      readiness: {
        rubric: rubric.status,
        rubricPresent: true,
      },
      rubric,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DPE rubric could not be saved.",
      },
      { status: 400 },
    );
  }
}
