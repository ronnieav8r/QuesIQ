import type { Session } from "next-auth";
import { cookies } from "next/headers";

export type DevAuthRole = "user" | "admin";

export const devAuthCookieName = "quesiq_dev_auth";

export const devAuthUsers: Record<DevAuthRole, Session["user"]> = {
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

export function normalizeDevAuthRole(value: unknown): DevAuthRole | undefined {
  return value === "user" || value === "admin" ? value : undefined;
}

export function isDevAuthAdminEmail(email?: string | null) {
  return Boolean(
    isDevAuthBypassEnabled() &&
      email &&
      email.toLowerCase() === devAuthUsers.admin.email?.toLowerCase(),
  );
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

  return {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user: devAuthUsers[role],
  };
}
