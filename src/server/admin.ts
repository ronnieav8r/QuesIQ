import { auth } from "@/auth";
import { isDevAuthAdminEmail } from "@/server/auth/dev-bypass";

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return adminEmails().has(email.toLowerCase()) || isDevAuthAdminEmail(email);
}

export async function requireAdminSession() {
  const appSession = await auth();

  if (!appSession?.user?.id || !isAdminEmail(appSession.user.email)) {
    return undefined;
  }

  return appSession;
}
