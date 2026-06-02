import { NextResponse } from "next/server";

import {
  createPasswordAccount,
  parsePasswordAccountInput,
} from "@/server/auth/password-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Account creation needs a configured database." },
      { status: 503 },
    );
  }

  const input = parsePasswordAccountInput(await request.json());

  if (!input) {
    return NextResponse.json({ error: "Account details are required." }, { status: 400 });
  }

  try {
    const account = await createPasswordAccount(input);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Account could not be created.",
      },
      { status: 400 },
    );
  }
}
