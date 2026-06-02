import { getSafeNextPath } from "@/features/platform/products";
import { CreateAccountPage } from "@/features/platform/create-account-page";

type CreateAccountRouteProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function CreateAccountRoutePage({
  searchParams,
}: CreateAccountRouteProps) {
  const params = await searchParams;
  const nextPath = getSafeNextPath(params?.next) || "/apps";

  return <CreateAccountPage nextPath={nextPath === "/" ? "/apps" : nextPath} />;
}
