import { PUT as saveArtifact } from "@/app/api/sessions/[sessionId]/artifact/route";
import { normalizeMobileResponse } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  return normalizeMobileResponse(await saveArtifact(request, context));
}
