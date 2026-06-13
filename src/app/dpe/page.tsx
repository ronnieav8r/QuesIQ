export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";

export default function DpeUnderDevelopmentPage() {
  return (
    <main className="marketing-page dpe-development-page">
      <section className="dpe-development-panel">
        <span className="development-watermark">Under Development</span>
        <Image alt="QuesIQ DPE" height={80} priority src="/brand/quesiq-dpe-logo.png" width={210} />
        <p className="marketing-kicker">QuesIQ DPE</p>
        <h1>DPE Command Center is under development.</h1>
        <p>
          Interview and Study are open for early testing. DPE will return after this
          release window.
        </p>
        <div className="marketing-hero-actions">
          <Link className="marketing-cta" href="/apps">
            Open Available Apps
          </Link>
          <Link className="marketing-secondary" href="/">
            QuesIQ Home
          </Link>
        </div>
      </section>
    </main>
  );
}
