import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createQuiraSupportReport,
  parseQuiraSupportReportInput,
} from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira support report needs a configured database." },
      { status: 503 },
    );
  }

  const input = parseQuiraSupportReportInput(await request.json());

  if (!input) {
    return NextResponse.json(
      { error: "Add a note, rating, or screenshot before sending." },
      { status: 400 },
    );
  }

  try {
    const result = await createQuiraSupportReport(input, {
      email: appSession.user.email,
      id: appSession.user.id,
      name: appSession.user.name,
      source: "signed_in",
    });

    return NextResponse.json({ report: result }, { status: 201 });
  } catch (error) {
    console.error("Quira support report failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Quira support report failed.",
        error: "Quira support report could not be saved.",
      },
      { status: 503 },
    );
  }
}
