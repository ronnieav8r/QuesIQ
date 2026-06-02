import { auth } from "@/auth";
import { AppsPage } from "@/features/platform/apps-page";

export default async function AppsRoutePage() {
  const appSession = await auth();

  return <AppsPage signedIn={Boolean(appSession?.user)} />;
}
