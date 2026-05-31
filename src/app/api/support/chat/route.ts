import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  checkQuiraRateLimit,
  handleQuiraChat,
  parseQuiraChatInput,
} from "@/server/support/quira-support";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const appSession = await auth();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Quira support chat needs a configured database." },
      { status: 503 },
    );
  }

  const input = parseQuiraChatInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Add a message before sending." }, { status: 400 });
  }

  if (!checkQuiraRateLimit(appSession.user.id)) {
    return NextResponse.json(
      { error: "Too many Quira messages. Wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const result = await handleQuiraChat(input, {
      email: appSession.user.email,
      id: appSession.user.id,
      name: appSession.user.name,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quira support chat failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Quira support chat failed.",
        error: "Quira support chat could not answer right now.",
      },
      { status: 503 },
    );
  }
}
