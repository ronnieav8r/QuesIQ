import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import {
  listQuiraAdminSupportData,
  parseQuiraSupportCaseStatus,
  syncQuiraKnowledgeToVectorStore,
  updateQuiraSupportCaseStatus,
} from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira support review needs a configured database." },
      { status: 503 },
    );
  }

  try {
    const support = await listQuiraAdminSupportData();

    return NextResponse.json({ support });
  } catch (error) {
    console.error("Quira admin support data failed.", error);

    return NextResponse.json(
      { error: "Quira support data could not be loaded." },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    caseId?: unknown;
    status?: unknown;
  };
  const caseId = typeof body.caseId === "string" ? body.caseId : undefined;
  const status = parseQuiraSupportCaseStatus(body.status);

  if (!caseId || !status) {
    return NextResponse.json(
      { error: "Valid caseId and status are required." },
      { status: 400 },
    );
  }

  try {
    const supportCase = await updateQuiraSupportCaseStatus({
      caseId,
      status,
      userId: appSession.user.id,
    });

    if (!supportCase) {
      return NextResponse.json(
        { error: "Quira support case was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ supportCase });
  } catch (error) {
    console.error("Quira support case update failed.", error);

    return NextResponse.json(
      { error: "Quira support case could not be updated." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
  };

  if (body.action !== "sync_vector_store") {
    return NextResponse.json({ error: "Unsupported Quira admin action." }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira vector sync needs a configured database." },
      { status: 503 },
    );
  }

  try {
    const result = await syncQuiraKnowledgeToVectorStore();

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Quira vector sync failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Quira vector sync failed.",
        error: "Quira vector sync could not complete.",
      },
      { status: 503 },
    );
  }
}
