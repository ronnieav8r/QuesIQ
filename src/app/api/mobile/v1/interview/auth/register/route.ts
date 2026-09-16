import { onboardingRequest } from "@/server/mobile-auth/onboarding-http";
export const runtime = "nodejs";
export function POST(request: Request) { return onboardingRequest(request, "register"); }
