import { LoginPage } from "@/features/platform/login-page";
import { getSafeNextPath, getSafeProductHref } from "@/features/platform/products";

type LoginRouteProps = {
  searchParams?: Promise<{
    next?: string;
    product?: string;
  }>;
};

export default async function LoginRoute({ searchParams }: LoginRouteProps) {
  const params = await searchParams;
  const nextPath = params?.next
    ? getSafeNextPath(params.next)
    : getSafeProductHref(params?.product);

  return <LoginPage nextPath={nextPath} />;
}
