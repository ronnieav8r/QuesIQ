import { AdminView } from "@/components/interview/admin-view";
import { PlatformPlaceholder, PlatformRouteShell } from "@/features/platform/platform-route-shell";
import { requireAdminSession } from "@/server/admin";

export default async function AdminPage() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return (
      <PlatformPlaceholder
        description="Admin is available only to signed-in QuesIQ admin accounts. Sign in through the app, then return here."
        eyebrow="QuesIQ Admin"
        primaryHref="/interview"
        primaryLabel="Sign In"
        status="Admin access required"
        title="Admin"
      />
    );
  }

  return (
    <PlatformRouteShell eyebrow="QuesIQ Admin" title="Admin">
      <AdminView />
    </PlatformRouteShell>
  );
}
