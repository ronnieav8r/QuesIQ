import { NextRequest, NextResponse } from "next/server";

import {
  devAuthCookieName,
  devAuthUsers,
  getDevAuthSession,
  isDevAuthBypassEnabled,
  normalizeDevAuthRole,
  type DevAuthRole,
} from "@/server/auth/dev-bypass";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const runtime = "nodejs";

const maxAgeSeconds = 30 * 24 * 60 * 60;

async function ensureDevAuthUser(role: DevAuthRole) {
  const devUser = devAuthUsers[role];

  await getDb()
    .insert(users)
    .values({
      email: devUser.email,
      emailVerified: new Date(),
      id: devUser.id,
      image: devUser.image,
      name: devUser.name,
    })
    .onConflictDoUpdate({
      set: {
        email: devUser.email,
        emailVerified: new Date(),
        image: devUser.image,
        name: devUser.name,
      },
      target: users.id,
    });
}

function unavailableResponse() {
  return NextResponse.json({ error: "Dev auth bypass is not enabled." }, { status: 404 });
}

export async function POST(request: NextRequest) {
  if (!isDevAuthBypassEnabled()) {
    return unavailableResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { role?: unknown };
  const role = normalizeDevAuthRole(body.role);

  if (!role) {
    return NextResponse.json({ error: "Choose a valid dev auth role." }, { status: 400 });
  }

  await ensureDevAuthUser(role);

  const response = NextResponse.json({
    ok: true,
    user: devAuthUsers[role],
  });

  response.cookies.set(devAuthCookieName, role, {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET() {
  if (!isDevAuthBypassEnabled()) {
    return unavailableResponse();
  }

  return NextResponse.json((await getDevAuthSession()) ?? null);
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(devAuthCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
