import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createStudyStack,
  getVisibleStudyStacks,
} from "@/features/study/study-data";
import { isAdminEmail } from "@/server/admin";

export async function GET() {
  const session = await auth();
  const stacks = await getVisibleStudyStacks(session?.user?.id);

  return NextResponse.json({ stacks });
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    description?: string | null;
    isOfficial?: boolean;
    isPublic?: boolean;
    subject?: string | null;
    title?: string;
  };
  const title = body.title?.trim();

  if (!title) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const stack = await createStudyStack({
    description: body.description?.trim() || null,
    isOfficial: isAdminEmail(session.user.email) ? Boolean(body.isOfficial) : false,
    isPublic: Boolean(body.isPublic),
    subject: body.subject?.trim() || null,
    title,
    userId: session.user.id,
  });

  return NextResponse.json({ stack }, { status: 201 });
}
