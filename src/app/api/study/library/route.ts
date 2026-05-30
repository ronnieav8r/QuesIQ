import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getStudyAudienceTags,
  getStudyLibraryDecks,
  getStudyRootSubjects,
  type StudyLibraryScope,
} from "@/features/study/study-data";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const subject = searchParams.get("subject") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const officialOnly = searchParams.get("official") === "1";
  const verifiedOnly = searchParams.get("verified") === "1";
  const rawScope = searchParams.get("scope");
  const scope: StudyLibraryScope =
    rawScope === "all" || rawScope === "mine" || rawScope === "public"
      ? rawScope
      : "all";

  const [decks, subjects, audienceTags] = await Promise.all([
    getStudyLibraryDecks({
      officialOnly,
      query: q,
      scope,
      subject,
      tag,
      userId,
      verifiedOnly,
    }),
    getStudyRootSubjects(),
    getStudyAudienceTags(),
  ]);

  return NextResponse.json({ audienceTags, decks, subjects });
}
