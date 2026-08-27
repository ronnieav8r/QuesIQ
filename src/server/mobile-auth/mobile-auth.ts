import { createHash, randomBytes, randomUUID } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

import { auth } from "@/auth";
import { getDb } from "@/server/db/client";
import { mobileRefreshTokens, users } from "@/server/db/schema";

const accessLifetimeSeconds = 15 * 60;
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const issuer = "quesiq-interview";
const audience = "quesiq-interview-mobile";

export type MobileUser = {
  email?: string;
  id: string;
  name?: string;
};

function cleanUser(user: { email?: string | null; id?: string; name?: string | null }): MobileUser {
  if (!user.id) {
    throw new Error("Authenticated user is missing an id.");
  }

  return {
    email: user.email ?? undefined,
    id: user.id,
    name: user.name ?? undefined,
  };
}

function signingSecret() {
  const value = process.env.MOBILE_AUTH_SECRET ||
    (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET : undefined);

  if (!value || value.length < 24) {
    throw new Error("MOBILE_AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(value);
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

async function signAccessToken(user: MobileUser) {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setAudience(audience)
    .setExpirationTime(`${accessLifetimeSeconds}s`)
    .setIssuedAt()
    .setIssuer(issuer)
    .setJti(randomUUID())
    .setSubject(user.id)
    .sign(signingSecret());
}

async function persistRefreshToken(userId: string, familyId = randomUUID()) {
  const refreshToken = randomBytes(32).toString("base64url");
  const refreshExpiresAt = new Date(Date.now() + refreshLifetimeMs);

  await getDb().insert(mobileRefreshTokens).values({
    expiresAt: refreshExpiresAt,
    familyId,
    tokenHash: hashRefreshToken(refreshToken),
    userId,
  });

  return { familyId, refreshExpiresAt, refreshToken };
}

export async function issueMobileTokenPair(input: MobileUser) {
  const user = cleanUser(input);
  const accessToken = await signAccessToken(user);
  const accessExpiresAt = new Date(Date.now() + accessLifetimeSeconds * 1000);
  const { refreshExpiresAt, refreshToken } = await persistRefreshToken(user.id);

  return {
    accessExpiresAt: accessExpiresAt.toISOString(),
    accessToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    refreshToken,
    user,
  };
}

export async function rotateMobileRefreshToken(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  return getDb().transaction(async (tx) => {
    const [claimed] = await tx
      .update(mobileRefreshTokens)
      .set({ revokedAt: now, updatedAt: now })
      .where(and(
        eq(mobileRefreshTokens.tokenHash, tokenHash),
        gt(mobileRefreshTokens.expiresAt, now),
        isNull(mobileRefreshTokens.revokedAt),
      ))
      .returning({ familyId: mobileRefreshTokens.familyId, userId: mobileRefreshTokens.userId });

    if (!claimed) {
      throw new Error("Refresh token is invalid or expired.");
    }

    const [row] = await tx
      .select({ email: users.email, id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, claimed.userId))
      .limit(1);

    if (!row) {
      throw new Error("Refresh token user is unavailable.");
    }

    const user = cleanUser(row);
    const nextRefreshToken = randomBytes(32).toString("base64url");
    const refreshExpiresAt = new Date(Date.now() + refreshLifetimeMs);

    await tx.insert(mobileRefreshTokens).values({
      expiresAt: refreshExpiresAt,
      familyId: claimed.familyId,
      tokenHash: hashRefreshToken(nextRefreshToken),
      userId: user.id,
    });

    return {
      accessExpiresAt: new Date(Date.now() + accessLifetimeSeconds * 1000).toISOString(),
      accessToken: await signAccessToken(user),
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      refreshToken: nextRefreshToken,
      user,
    };
  });
}

export async function revokeMobileRefreshToken(refreshToken: string) {
  await getDb()
    .update(mobileRefreshTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(mobileRefreshTokens.tokenHash, hashRefreshToken(refreshToken)),
      isNull(mobileRefreshTokens.revokedAt),
    ));
}

export async function verifyMobileAccessToken(token: string): Promise<MobileUser | undefined> {
  try {
    const { payload } = await jwtVerify(token, signingSecret(), { audience, issuer });

    if (!payload.sub) {
      return undefined;
    }

    return {
      email: typeof payload.email === "string" ? payload.email : undefined,
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function resolveRequestUser(request: Request): Promise<MobileUser | undefined> {
  const authorization = request.headers.get("Authorization");

  if (authorization?.startsWith("Bearer ")) {
    return verifyMobileAccessToken(authorization.slice("Bearer ".length).trim());
  }

  const appSession = await auth();
  return appSession?.user?.id ? cleanUser(appSession.user) : undefined;
}
