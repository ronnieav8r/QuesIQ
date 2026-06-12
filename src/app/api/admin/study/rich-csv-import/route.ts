import { NextResponse } from "next/server";

import {
  addDeckToStudyStack,
  createStudyDeck,
  createStudyStack,
  getStudyDeck,
  updateStudyDeck,
} from "@/features/study/study-data";
import { requireAdminSession } from "@/server/admin";
import {
  type StudyRichImportColumnMapping,
  STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING,
  STUDY_RICH_IMPORT_HEADERS,
  STUDY_RICH_IMPORT_SAMPLE_CSV,
  parseStudyRichFlashcardImportText,
  saveStudyRichFlashcardImport,
} from "@/server/study/study-rich-flashcard-import";

export const runtime = "nodejs";

type Body = {
  columnMapping?: StudyRichImportColumnMapping;
  createDeckDescription?: string;
  createDeckSubject?: string;
  createDeckTags?: string[];
  createDeckTitle?: string;
  createStackDescription?: string;
  createStackSubject?: string;
  createStackTitle?: string;
  csvText?: string;
  deckId?: string;
  markDeckOfficial?: boolean;
  markDeckPublic?: boolean;
  markStackOfficial?: boolean;
  markStackPublic?: boolean;
  mode?: "preview" | "save";
  stackId?: string;
  stackMode?: "existing" | "new" | "none";
  targetMode?: "existing" | "new";
};

function richCsvResponse(parsed: ReturnType<typeof parseStudyRichFlashcardImportText>) {
  return {
    csvHeaders: STUDY_RICH_IMPORT_HEADERS,
    defaultColumnMapping: STUDY_RICH_IMPORT_DEFAULT_COLUMN_MAPPING,
    delimiter: parsed.delimiter,
    detectedHeaders: parsed.detectedHeaders,
    effectiveMapping: parsed.effectiveMapping,
    expertReviewStatusCounts: parsed.expertReviewStatusCounts,
    rowCount: parsed.rowCount,
    rows: parsed.rows,
    sourceCoverage: parsed.sourceCoverage,
    supportedTargetFields: STUDY_RICH_IMPORT_HEADERS,
    unmappedRequiredFields: parsed.unmappedRequiredFields,
    validationErrors: parsed.errors,
    validationWarnings: parsed.warnings,
    verificationStatusCounts: parsed.verificationStatusCounts,
  };
}

export async function POST(request: Request) {
  const session = await requireAdminSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const csvText = (body.csvText ?? "").trim();
  const parsed = parseStudyRichFlashcardImportText(
    body.mode === "preview" ? csvText || STUDY_RICH_IMPORT_SAMPLE_CSV : csvText,
    { columnMapping: body.columnMapping },
  );

  if (body.mode !== "save") {
    return NextResponse.json({
      ...richCsvResponse(parsed),
      richCsvImportPreviewOnly: true,
    });
  }

  if (!csvText) {
    return NextResponse.json({ error: "CSV text is required." }, { status: 400 });
  }

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      {
        ...richCsvResponse(parsed),
        error: "CSV contains validation errors.",
      },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "No valid import rows found." }, { status: 400 });
  }

  let deckId = body.targetMode === "existing" ? body.deckId?.trim() : undefined;

  if (body.targetMode === "existing") {
    if (!deckId) {
      return NextResponse.json({ error: "Choose an existing deck." }, { status: 400 });
    }
    const deck = await getStudyDeck(deckId);
    if (!deck) {
      return NextResponse.json({ error: "Deck not found." }, { status: 404 });
    }
    if (body.markDeckPublic === true) {
      await updateStudyDeck(deckId, { isPublic: true });
    }
  } else {
    const title =
      body.createDeckTitle?.trim() ||
      parsed.rows[0]?.deckTitle?.trim() ||
      parsed.rows[0]?.subject?.trim() && `${parsed.rows[0].subject} Study Deck` ||
      "Imported Study Deck";
    const tags = Array.isArray(body.createDeckTags)
      ? body.createDeckTags.map((tag) => tag.trim()).filter(Boolean)
      : parsed.rows[0]?.tags ?? [];
    const deck = await createStudyDeck({
      description: body.createDeckDescription?.trim() || parsed.rows[0]?.deckDescription?.trim() || undefined,
      isPublic: Boolean(body.markDeckPublic),
      subject: body.createDeckSubject?.trim() || parsed.rows[0]?.subject?.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      title,
      userId: session.user.id,
    });
    deckId = deck.id;
  }

  const markDeckOfficial = body.markDeckOfficial === true || parsed.rows.some((row) => row.isOfficial === true);
  const saveResult = await saveStudyRichFlashcardImport({
    adminUserId: session.user.id,
    deckId,
    markDeckOfficial,
    rows: parsed.rows,
  });

  let stackResult:
    | { attached: false }
    | { attached: true; created: boolean; stackId: string }
    | { attached: false; error: string } = { attached: false };

  if (body.stackMode === "existing") {
    const stackId = body.stackId?.trim();
    if (!stackId) {
      stackResult = { attached: false, error: "No stack selected." };
    } else {
      const item = await addDeckToStudyStack({ deckId, stackId, userId: session.user.id });
      stackResult = item ? { attached: true, created: false, stackId } : { attached: false, error: "Stack not found." };
    }
  } else if (body.stackMode === "new") {
    const title = body.createStackTitle?.trim();
    if (!title) {
      stackResult = { attached: false, error: "No stack title provided." };
    } else {
      const stack = await createStudyStack({
        description: body.createStackDescription?.trim() || null,
        isOfficial: Boolean(body.markStackOfficial),
        isPublic: Boolean(body.markStackPublic),
        subject: body.createStackSubject?.trim() || parsed.rows[0]?.subject?.trim() || null,
        title,
        userId: session.user.id,
      });
      await addDeckToStudyStack({ deckId, stackId: stack.id, userId: session.user.id });
      stackResult = { attached: true, created: true, stackId: stack.id };
    }
  }

  return NextResponse.json({
    ...richCsvResponse(parsed),
    richCsvImportSaved: true,
    saveResult,
    stackResult,
    storage: {
      detail:
        "Study admin CSV import saved cards plus source verification and separate expert review metadata. Official is deck/stack level; Verified is source/fact verification only.",
      durableReviewState: true,
    },
  });
}
