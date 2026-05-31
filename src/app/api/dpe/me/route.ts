import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminEmail } from "@/server/admin";

const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({
      authenticated: false,
      githubEnabled,
      googleEnabled,
      isAdmin: false,
      user: null,
    });
  }

  return NextResponse.json({
    authenticated: true,
    githubEnabled,
    googleEnabled,
    isAdmin: isAdminEmail(session.user.email),
    user: {
      email: session.user.email,
      id: session.user.id,
      name: session.user.name,
    },
  });
}
