import { Redirect } from "expo-router";

import { LoadingState } from "@/components/ui/states";
import { useAuth } from "@/providers/auth-provider";

export default function EntryScreen() {
  const { ready, tokens } = useAuth();
  if (!ready) return <LoadingState label="Opening QuesIQ Interview…" />;
  return <Redirect href={tokens ? "/(tabs)/home" : "/sign-in"} />;
}
