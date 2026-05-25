import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/admin";
import { listFeedback } from "@/server/feedback/user-feedback";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const feedback = await listFeedback(100);

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Feedback list failed.", error);

    return NextResponse.json(
      {
        detail: "The database could not load feedback.",
        error: "Feedback could not be loaded.",
      },
      { status: 503 },
    );
  }
}
