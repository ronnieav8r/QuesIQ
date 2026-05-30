import { AdminConsole } from "@/features/admin/admin-console";
import { PlatformPlaceholder, PlatformRouteShell } from "@/features/platform/platform-route-shell";
import { requireAdminSession } from "@/server/admin";

type Props = {
  searchParams?: Promise<{ product?: string }>;
};

export default async function AdminPage({ searchParams }: Props) {
  const appSession = await requireAdminSession();
  const { product } = (await searchParams) ?? {};

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
      <AdminConsole product={product} />
    </PlatformRouteShell>
  );
}
