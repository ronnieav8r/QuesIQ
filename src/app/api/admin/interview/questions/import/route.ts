import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  INTERVIEW_QUESTION_CSV_HEADERS,
  parseInterviewQuestionImportText,
  saveInterviewQuestionImport,
} from "@/server/interview/question-bank";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    csvText?: string;
    mode?: "preview" | "save";
    sourceLabel?: string;
  };
  const csvText = body.csvText?.trim();

  if (!csvText) {
    return NextResponse.json({ error: "csvText is required." }, { status: 400 });
  }

  if (body.mode === "save") {
    const parsed = parseInterviewQuestionImportText(csvText);
    if (parsed.errors.some((error) => error.severity === "error")) {
      return NextResponse.json(
        {
          csvHeaders: INTERVIEW_QUESTION_CSV_HEADERS,
          detectedHeaders: parsed.detectedHeaders,
          error: "CSV contains validation errors.",
          rowCount: parsed.rowCount,
          rows: parsed.rows,
          validationErrors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const saved = await saveInterviewQuestionImport({
      adminUserId: appSession.user.id,
      csvText,
      sourceLabel: body.sourceLabel,
    });

    return NextResponse.json({
      createdCount: saved.createdCount,
      csvHeaders: INTERVIEW_QUESTION_CSV_HEADERS,
      detectedHeaders: saved.parsed.detectedHeaders,
      importId: saved.importId,
      rowCount: saved.parsed.rowCount,
      rows: saved.parsed.rows,
      updatedCount: saved.updatedCount,
      validationErrors: saved.parsed.errors,
    });
  }

  const parsed = parseInterviewQuestionImportText(csvText);

  return NextResponse.json({
    csvHeaders: INTERVIEW_QUESTION_CSV_HEADERS,
    detectedHeaders: parsed.detectedHeaders,
    previewOnly: true,
    rowCount: parsed.rowCount,
    rows: parsed.rows,
    validationErrors: parsed.errors,
  });
}
