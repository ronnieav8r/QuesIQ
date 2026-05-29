import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { deleteStudyFolder, updateStudyFolder } from "@/features/study/study-data";
import { getDb } from "@/server/db/client";
import { studyFolders } from "@/server/db/schema";

async function requireFolderOwner(folderId: string, userId: string) {
  const [folder] = await getDb()
    .select()
    .from(studyFolders)
    .where(and(eq(studyFolders.id, folderId), eq(studyFolders.userId, userId)))
    .limit(1);

  return folder ?? null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<unknown> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = (await context.params) as Record<string, string | string[] | undefined>;
  const folderId = typeof params.folderId === "string" ? params.folderId : "";
  if (!folderId) {
    return NextResponse.json({ error: "Missing folder id." }, { status: 400 });
  }

  const folder = await requireFolderOwner(folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
  }

  const updated = await updateStudyFolder(folderId, { name });
  return NextResponse.json({ folder: updated });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<unknown> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = (await context.params) as Record<string, string | string[] | undefined>;
  const folderId = typeof params.folderId === "string" ? params.folderId : "";
  if (!folderId) {
    return NextResponse.json({ error: "Missing folder id." }, { status: 400 });
  }

  const folder = await requireFolderOwner(folderId, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteStudyFolder(folderId);
  return new NextResponse(null, { status: 204 });
}
