import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createStudyFolder, getStudyFolders } from "@/features/study/study-data";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ folders: [] });
  }
  const folders = await getStudyFolders(session.user.id);
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
  }

  const folder = await createStudyFolder({
    name,
    userId: session.user.id,
  });

  return NextResponse.json({ folder }, { status: 201 });
}
