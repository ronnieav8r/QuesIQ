import { ResetPasswordPage } from "@/features/platform/reset-password-page";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;

  return <ResetPasswordPage initialEmail={params.email ?? ""} token={params.token ?? ""} />;
}
