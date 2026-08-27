import { POST as createEvaluation } from "@/app/api/sessions/[sessionId]/evaluation/route";
import { normalizeMobileResponse } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  return normalizeMobileResponse(await createEvaluation(request, context));
}
