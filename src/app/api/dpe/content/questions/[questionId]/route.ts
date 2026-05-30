import { NextResponse } from "next/server";

import {
  parseDpeQuestionDraft,
  upsertDpeOralQuestion,
} from "@/server/dpe/content-admin";
import { requireAdminSession } from "@/server/admin";

type RouteContext = {
  params: Promise<{
    questionId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { questionId } = await context.params;
  const parsed = parseDpeQuestionDraft({
    ...(await request.json()),
    id: decodeURIComponent(questionId),
  });

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const question = await upsertDpeOralQuestion(parsed.value);

    return NextResponse.json({ question });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "DPE question could not be saved.",
      },
      { status: 400 },
    );
  }
}
