"use client";

import { signOut } from "next-auth/react";

export async function signOutFromApp(options: { redirectTo?: string } = {}) {
  await fetch("/api/dev-auth/session", { method: "DELETE" }).catch(() => undefined);
  await signOut({ redirectTo: options.redirectTo ?? "/" });
}
