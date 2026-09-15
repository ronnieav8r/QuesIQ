import { NextRequest, NextResponse } from "next/server";

// Dedicated mobile hosting is opt-in; the local platform keeps its existing routes.
export function proxy(request: NextRequest) {
  if (process.env.QUESIQ_DEPLOYMENT !== "interview-mobile") return NextResponse.next();

  const path = request.nextUrl.pathname;
  const mobile = path.startsWith("/api/mobile/v1/interview/");
  const developmentAuth = path === "/api/mobile/v1/interview/auth/dev-session" ||
    path.startsWith("/api/mobile/v1/interview/auth/dev-session/");
  if (path === "/health" || (mobile && !developmentAuth)) return NextResponse.next();

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export const config = { matcher: "/:path*" };
