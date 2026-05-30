import { NextResponse } from "next/server";

import {
  parseDpeAnswerKeyDraft,
  upsertDpeAnswerKey,
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

  const parsed = parseDpeAnswerKeyDraft(await request.json());

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { questionId } = await context.params;

  try {
    const answerKey = await upsertDpeAnswerKey(decodeURIComponent(questionId), parsed.value);

    return NextResponse.json({
      answerKey,
      readiness: {
        answerKey: answerKey.status,
        answerKeyPresent: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DPE answer key could not be saved.",
      },
      { status: 400 },
    );
  }
}
