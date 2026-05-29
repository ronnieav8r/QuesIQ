import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/server/admin";

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({
      authenticated: false,
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      isAdmin: false,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    isAdmin: isAdminEmail(session.user.email),
    user: {
      email: session.user.email,
      id: session.user.id,
      name: session.user.name,
    },
  });
}
