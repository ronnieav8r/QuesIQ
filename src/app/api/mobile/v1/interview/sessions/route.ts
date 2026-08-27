import { GET as getSessions, POST as createSession } from "@/app/api/sessions/route";
import { normalizeMobileResponse } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return normalizeMobileResponse(await getSessions(request));
}

export async function POST(request: Request) {
  return normalizeMobileResponse(await createSession(request));
}
