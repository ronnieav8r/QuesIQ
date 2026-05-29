import { auth } from "@/auth";
import { PlatformPlaceholder } from "@/features/platform/platform-route-shell";

export default async function AccountPage() {
  const appSession = await auth();

  return (
    <PlatformPlaceholder
      description={
        appSession?.user?.email
          ? `Signed in as ${appSession.user.email}. Shared account settings will live here as the platform shell grows.`
          : "Shared account settings will live here. For now, sign in through the Interview app."
      }
      eyebrow="QuesIQ Account"
      primaryHref="/interview"
      primaryLabel={appSession?.user ? "Open Interview" : "Sign In"}
      title="Account"
    />
  );
}
