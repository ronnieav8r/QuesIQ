import { POST as exchangeRealtimeSdp } from "@/app/api/realtime/session/route";
import { normalizeMobileResponse } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return normalizeMobileResponse(await exchangeRealtimeSdp(request));
}
