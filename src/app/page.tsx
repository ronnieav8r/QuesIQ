import { redirect } from "next/navigation";

import MarketingHome from "@/features/marketing/marketing-home";
import { isLocalInterviewAutoEntryEnabled } from "@/server/auth/dev-bypass";

export default function HomePage() {
  if (isLocalInterviewAutoEntryEnabled()) {
    redirect("/interview");
  }

  return <MarketingHome />;
}
