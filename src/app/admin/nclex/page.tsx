import NclexAdminApp from "@/features/nclex/nclex-admin-app";
import { PlatformPlaceholder } from "@/features/platform/platform-route-shell";
import { requireAdminSession } from "@/server/admin";

export default async function NclexAdminPage() {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return (
      <PlatformPlaceholder
        description="NCLEX admin is available only to signed-in QuesIQ admin accounts."
        eyebrow="QuesIQ Admin"
        primaryHref="/login?next=/admin/nclex"
        primaryLabel="Sign In"
        status="Admin access required"
        title="NCLEX Admin"
      />
    );
  }

  return <NclexAdminApp />;
}
