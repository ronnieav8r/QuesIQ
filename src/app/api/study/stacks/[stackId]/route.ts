import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteStudyStack,
  getStudyStack,
  getStudyStackWithDecks,
  updateStudyStack,
} from "@/features/study/study-data";
import { isAdminEmail } from "@/server/admin";

type Params = {
  params: Promise<{ stackId: string }>;
};

async function requireStackOwner(stackId: string, userId: string) {
  const stack = await getStudyStack(stackId);

  if (!stack) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  if (stack.userId !== userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { stack };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();
  const stack = await getStudyStackWithDecks(stackId, session?.user?.id);

  if (!stack) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ stack });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requireStackOwner(stackId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  const body = (await request.json()) as {
    description?: string | null;
    isOfficial?: boolean;
    isPublic?: boolean;
    subject?: string | null;
    title?: string;
  };
  const stack = await updateStudyStack(stackId, session.user.id, {
    ...(body.description !== undefined && { description: body.description?.trim() || null }),
    ...(body.isOfficial !== undefined &&
      isAdminEmail(session.user.email) && { isOfficial: Boolean(body.isOfficial) }),
    ...(body.isPublic !== undefined && { isPublic: Boolean(body.isPublic) }),
    ...(body.subject !== undefined && { subject: body.subject?.trim() || null }),
    ...(body.title !== undefined && { title: body.title.trim() }),
  });

  return NextResponse.json({ stack });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { stackId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requireStackOwner(stackId, session.user.id);

  if ("error" in result) {
    return result.error;
  }

  await deleteStudyStack(stackId, session.user.id);

  return new NextResponse(null, { status: 204 });
}
