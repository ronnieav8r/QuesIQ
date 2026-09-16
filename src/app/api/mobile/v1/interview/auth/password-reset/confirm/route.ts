import { accountLinkPage, accountLinkSubmit } from "@/server/mobile-auth/onboarding-http";
export const runtime = "nodejs";
export function GET(request: Request) { return accountLinkPage(request, "reset"); }
export function POST(request: Request) { return accountLinkSubmit(request, "reset"); }
