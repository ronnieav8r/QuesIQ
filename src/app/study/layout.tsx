import type { ReactNode } from "react";

import { auth } from "@/auth";
import { StudyShell } from "@/features/study/study-shell";

export default async function StudyLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const authSession = await auth();

  return (
    <StudyShell authSession={authSession}>{children}</StudyShell>
  );
}
