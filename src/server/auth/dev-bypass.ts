import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";

export type DevAuthRole = "user" | "admin" | "e2e-admin";

export const devAuthCookieName = "quesiq_dev_auth";

export const devAuthUsers: Record<Exclude<DevAuthRole, "e2e-admin">, Session["user"]> = {
  user: {
    email: "dev-user@quesiq.local",
    id: "dev-user",
    image: null,
    name: "Dev User",
  },
  admin: {
    email: "dev-admin@quesiq.local",
    id: "dev-admin",
    image: null,
    name: "Dev Admin",
  },
};

const enabledValues = new Set(["1", "true", "yes", "on"]);

export function isDevAuthBypassEnabled() {
  return enabledValues.has((process.env.DEV_AUTH_BYPASS_ENABLED || "").trim().toLowerCase());
}

function isE2ETestMode() {
  return enabledValues.has((process.env.E2E_TEST_MODE || "").trim().toLowerCase());
}

export function normalizeDevAuthRole(value: unknown): DevAuthRole | undefined {
  if (value === "user" || value === "admin") {
    return value;
  }

  if (value === "e2e-admin" && isE2ETestMode()) {
    return value;
  }

  return undefined;
}

export function isDevAuthAdminEmail(email?: string | null) {
  return Boolean(
    isDevAuthBypassEnabled() &&
      email &&
      email.toLowerCase() === devAuthUsers.admin.email?.toLowerCase(),
  );
}

export async function getDevAuthUser(role: DevAuthRole): Promise<Session["user"] | undefined> {
  if (role !== "e2e-admin") {
    return devAuthUsers[role];
  }

  if (!isE2ETestMode()) {
    return undefined;
  }

  const email = process.env.E2E_TEST_EMAIL || "quesiq-e2e-admin@example.com";
  const [user] = await getDb()
    .select({
      email: users.email,
      id: users.id,
      image: users.image,
      name: users.name,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return undefined;
  }

  return user;
}

export async function getDevAuthSession(): Promise<Session | undefined> {
  if (!isDevAuthBypassEnabled()) {
    return undefined;
  }

  const cookieStore = await cookies();
  const role = normalizeDevAuthRole(cookieStore.get(devAuthCookieName)?.value);

  if (!role) {
    return undefined;
  }

  const user = await getDevAuthUser(role);
  if (!user) {
    return undefined;
  }

  return {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user,
  };
}
