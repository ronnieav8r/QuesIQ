import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/server/admin";

export const runtime = "nodejs";

export async function GET() {
  const appSession = await auth();

  return NextResponse.json({
    admin: Boolean(appSession?.user?.id && isAdminEmail(appSession.user.email)),
  });
}
