export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { auth } from "@/auth";
import { StudyStackForm } from "@/features/study/study-stack-form";

export default async function NewStudyStackPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?next=/study/stacks/new");
  }

  return (
    <div className="screen study-dashboard-screen">
      <div className="screen-toolbar">
        <Link className="back-button" href="/study/stacks">
          <ChevronLeft size={16} aria-hidden="true" />
          Stacks
        </Link>
      </div>
      <div>
        <p className="eyebrow">QuesIQ Study</p>
        <h1>New Stack</h1>
      </div>
      <section className="panel study-empty-panel">
        <StudyStackForm />
      </section>
    </div>
  );
}
