import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/server/admin";
import { CoachingOperationError } from "@/server/interview/coaching-operations";
import { coachingInspectionCsv, executeInspectorAction, inspectorActionSchema, listCoachingInspections, readCoachingInspection, safeInspectionExport } from "@/server/interview/coaching-inspector";
import { mobileApiError } from "@/server/mobile-auth/responses";

export const runtime = "nodejs";
async function authorize(request: Request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return undefined;
  const origin = request.headers.get("origin");
  // Next's internal request URL can use localhost while the browser uses 127.0.0.1.
  // Validate the actual Host header, not an untrusted forwarded-host header.
  const host = new URL(`${url.protocol}//${request.headers.get("host") || url.host}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname)) return undefined;
  if (request.method !== "GET" && origin) {
    const browserOrigin = new URL(origin);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(browserOrigin.hostname)
      || browserOrigin.port !== host.port || browserOrigin.protocol !== host.protocol) return undefined;
  }
  return (await requireAdminSession())?.user?.id;
}
function failure(error: unknown) {
  if (error instanceof CoachingOperationError) return mobileApiError(error.code, error.message, error.status, ["turn_processing", "simulated_failure"].includes(error.code));
  return mobileApiError("inspector_failed", "The local Coaching inspector could not complete this request.", 503, true);
}
export async function GET(request: Request) {
  const userId = await authorize(request);
  if (!userId) return mobileApiError("forbidden", "Local admin access is required.", 403);
  try {
    const url = new URL(request.url); const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ runs: await listCoachingInspections(userId) });
    if (!z.string().uuid().safeParse(id).success) return mobileApiError("invalid_id", "Invalid run ID.", 400);
    const run = await readCoachingInspection(userId, id);
    const format = url.searchParams.get("export");
    if (format === "csv" || format === "json") return new Response(format === "csv" ? coachingInspectionCsv(run) : JSON.stringify(safeInspectionExport(run), null, 2), {
      headers: { "Content-Type": format === "csv" ? "text/csv;charset=utf-8" : "application/json", "Content-Disposition": `attachment; filename="coaching-${id}.${format}"`, "Cache-Control": "no-store" },
    });
    return NextResponse.json(safeInspectionExport(run), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const userId = await authorize(request);
  if (!userId) return mobileApiError("forbidden", "Local admin access is required.", 403);
  const raw = await request.text();
  if (raw.length > 50_000) return mobileApiError("too_large", "Request is too large.", 413);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return mobileApiError("invalid_json", "Invalid JSON.", 400); }
  const parsed = inspectorActionSchema.safeParse(json);
  if (!parsed.success) return mobileApiError("invalid_payload", "Check the test input.", 400);
  try { return NextResponse.json(safeInspectionExport(await executeInspectorAction(userId, parsed.data))); }
  catch (error) { return failure(error); }
}
