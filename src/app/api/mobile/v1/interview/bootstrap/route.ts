import { NextResponse } from "next/server";

import { listInterviewCatalog } from "@/server/catalog/list-interview-catalog";
import { listJobTargets } from "@/server/job-targets/job-targets";
import { resolveRequestUser } from "@/server/mobile-auth/mobile-auth";
import { mobileApiError } from "@/server/mobile-auth/responses";
import { getProfile } from "@/server/profiles/get-profile";
import { listOwnedSessions } from "@/server/sessions/list-owned-sessions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await resolveRequestUser(request);

  if (!user) {
    return mobileApiError("unauthorized", "Sign in is required.", 401);
  }

  try {
    const [catalog, jobTargets, profile, sessions] = await Promise.all([
      listInterviewCatalog(),
      listJobTargets(user.id),
      getProfile(user.id),
      listOwnedSessions(user.id, 50),
    ]);

    return NextResponse.json({
      catalog: {
        ...catalog,
        practiceModes: catalog.practiceModes.filter((mode) => mode.key !== "hands_free_coaching"),
      },
      jobTargets,
      profile,
      sessions,
      user,
    });
  } catch (error) {
    console.error("Mobile bootstrap failed.", error);
    return mobileApiError("bootstrap_failed", "Interview data could not be loaded.", 503, true);
  }
}
