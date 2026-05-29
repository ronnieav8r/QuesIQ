import { NextResponse } from "next/server";

import { getPublicStudyDecks } from "@/features/study/study-data";

export async function GET() {
  return NextResponse.json({ decks: await getPublicStudyDecks() });
}
