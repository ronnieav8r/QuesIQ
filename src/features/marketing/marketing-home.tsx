import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Mic,
  Plane,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Volume2,
} from "lucide-react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";

import { auth } from "@/auth";
import { AccountActions } from "@/components/auth-control";
import { MarketingQuiraLauncher } from "@/features/marketing/marketing-quira-launcher";
import { getMarketingAppStatuses } from "@/server/platform/marketing-status";

const trustItems = [
  { icon: Volume2, label: "Voice-first practice" },
  { icon: Brain, label: "AI feedback loops" },
  { icon: ShieldCheck, label: "Private by design" },
  { icon: TrendingUp, label: "Progress you can track" },
];

const steps = [
  {
    body: "Pick Interview, Study, DPE, or NCLEX and start with the kind of preparation that matches your goal.",
    icon: Sparkles,
    title: "Choose your path",
  },
  {
    body: "Speak, answer, review cards, or work through scenario prompts with AI guidance in the moment.",
    icon: Mic,
    title: "Practice with AI",
  },
  {
    body: "Get concrete feedback, save progress, and come back to the next best action.",
    icon: BarChart3,
    title: "Improve every session",
  },
];

export default async function MarketingHome() {
  const appSession = await auth();
  const appStatuses = await getMarketingAppStatuses(appSession?.user?.id);

  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <Link className="marketing-logo" href="/" aria-label="QuesIQ home">
          <Image alt="QuesIQ" height={70} priority src="/brand/quesiq-main-logo.png" width={210} />
        </Link>
        <nav className="marketing-links" aria-label="Marketing navigation">
          <a href="#products">Products</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#trust">Why QuesIQ</a>
        </nav>
        <div className="marketing-actions">
          <AccountActions />
          <Link className="marketing-cta" href="/apps">
            Start Practicing
          </Link>
        </div>
      </header>

      <section className="marketing-hero">
        <div className="marketing-hero-copy">
          <div className="marketing-pill">
            <Sparkles aria-hidden="true" />
            AI practice platform
          </div>
          <h1>
            The AI practice platform to prepare by{" "}
            <span>speaking, studying, and improving</span> with feedback.
          </h1>
          <p>
            QuesIQ helps people build real-world confidence through AI-powered
            practice, personalized feedback, and focused study tools.
          </p>
          <div className="marketing-hero-actions">
            <Link className="marketing-cta" href="/apps">
              Start Practicing
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className="marketing-secondary" href="/create-account">
              Create Account
            </Link>
            <a className="marketing-secondary" href="#products">
              Explore Products
            </a>
          </div>
          <div className="marketing-trust-row" aria-label="QuesIQ strengths">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <span key={item.label}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="marketing-dashboard" aria-label="QuesIQ product preview">
          <div className="dashboard-sidebar">
            <Image alt="" height={52} src="/brand/quesiq-icon.png" width={52} />
            <span className="active"><Mic aria-hidden="true" /></span>
            <span><BookOpenCheck aria-hidden="true" /></span>
            <span><Plane aria-hidden="true" /></span>
            <span><Stethoscope aria-hidden="true" /></span>
            <span><BarChart3 aria-hidden="true" /></span>
          </div>
          <div className="dashboard-main">
            <div className="dashboard-topline">
              <div>
                <strong>Welcome back, Alex</strong>
                <small>Ready to level up today?</small>
              </div>
              <span>Live Practice</span>
            </div>
            <div className="dashboard-grid">
              <article className="mock-card interview-preview">
                <div className="mock-card-head">
                  <strong>Interview Practice</strong>
                  <span>In Progress</span>
                </div>
                <p>Tell me about a time you handled a difficult situation.</p>
                <div className="waveform" aria-hidden="true">
                  {Array.from({ length: 22 }).map((_, index) => (
                    <i key={index} style={{ height: `${22 + ((index * 19) % 46)}%` }} />
                  ))}
                </div>
                <div className="recording-row">
                  <span>Recording...</span>
                  <button aria-label="Microphone preview">
                    <Mic aria-hidden="true" />
                  </button>
                  <span>00:28</span>
                </div>
              </article>
              <article className="mock-card feedback-preview">
                <strong>AI Feedback</strong>
                <div className="score-ring">87</div>
                <div className="score-bars">
                  <span><b>Clarity</b><i style={{ width: "90%" }} /></span>
                  <span><b>Confidence</b><i style={{ width: "86%" }} /></span>
                  <span><b>Relevance</b><i style={{ width: "82%" }} /></span>
                </div>
              </article>
              <article className="mock-card study-preview">
                <strong>Study Cards</strong>
                <p>Biology - Genetics</p>
                <div className="mini-stats">
                  <span><b>32</b> Cards Reviewed</span>
                  <span><b>92%</b> Retention</span>
                </div>
                <div className="sparkline" aria-hidden="true" />
              </article>
              <article className="mock-card dpe-preview">
                <strong>DPE Oral Prep</strong>
                <p>Systems - Electrical</p>
                <div className="readiness-line">
                  <span>76%</span>
                  <i />
                </div>
              </article>
              <article className="mock-card nclex-preview">
                <strong>NCLEX-RN</strong>
                <p>Clinical judgment - Recognize cues</p>
                <div className="readiness-line">
                  <span>72%</span>
                  <i />
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-products marketing-app-statuses" id="products">
        <div className="marketing-section-heading">
          <p>App Status</p>
          <h2>{appSession?.user ? "Your QuesIQ command center" : "Four ways to prepare"}</h2>
          <span>
            {appSession?.user
              ? "Jump into the app that needs attention next, with progress visible at a glance."
              : "Sign in to turn Interview, Study, DPE, and NCLEX previews into personal progress dashboards."}
          </span>
        </div>
        <div className="marketing-status-grid">
          {appStatuses.map((status) => {
            const scoreStyle = { "--status-score": `${status.score}%` } as CSSProperties;

            return (
              <article
                className={`marketing-status-card ${status.key}`}
                key={status.key}
              >
                <div className="status-card-top">
                  <Image
                    alt={status.logoAlt}
                    height={58}
                    src={status.logoSrc}
                    width={172}
                  />
                  <div>
                    <p>{status.levelLabel}</p>
                    <h3>{status.title}</h3>
                  </div>
                </div>
                <div className="status-card-body">
                  <div className="status-score-ring" style={scoreStyle}>
                    <strong>{status.score}</strong>
                    <span>{status.metricLabel}</span>
                  </div>
                  <div className="status-summary">
                    <p>{status.subtitle}</p>
                    <div className="status-facts">
                      <span>
                        <b>{status.statValue}</b>
                        {status.statLabel}
                      </span>
                      <span>
                        <b>{status.lastUsedLabel}</b>
                        Activity
                      </span>
                    </div>
                  </div>
                </div>
                <div className="status-bars">
                  {status.bars.map((bar) => (
                    <div className="status-bar-row" key={bar.label}>
                      <span>{bar.label}</span>
                      <i className={bar.tone}>
                        <b style={{ width: `${bar.value}%` }} />
                      </i>
                    </div>
                  ))}
                </div>
                <div className="status-next-action">
                  <p>{status.nextAction}</p>
                  <Link href={status.href}>
                    Open {status.title}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="marketing-split" id="how-it-works">
        <div>
          <p className="marketing-kicker">How It Works</p>
          <h2>Simple steps. Powerful results.</h2>
          <div className="marketing-steps">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title}>
                  <span>
                    <Icon aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{index + 1}. {step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
          <Link className="marketing-cta" href="/apps">
            Start Practicing
          </Link>
        </div>
        <div className="marketing-trust-panel" id="trust">
          <p className="marketing-kicker">Why QuesIQ</p>
          <h2>AI practice you can trust</h2>
          <div className="trust-grid">
            {[
              ["Voice-first by design", "Natural conversations that build confidence."],
              ["Actionable feedback", "AI analysis highlights strengths and gaps."],
              ["Personalized to you", "Adaptive practice that meets you where you are."],
              ["Track what matters", "Clear progress dashboards keep you moving."],
              ["Built on expertise", "Designed for real preparation, not generic chat."],
              ["Private and secure", "Your practice data stays in your account."],
            ].map(([title, body]) => (
              <article key={title}>
                <CheckCircle2 aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-proof">
        <div>
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>Trusted by learners, built for real results</h2>
            <p>From first interviews to final checkrides, QuesIQ helps you show up prepared.</p>
          </div>
        </div>
        <div className="proof-stats">
          <span><b>20K+</b> Active Learners</span>
          <span><b>2M+</b> Practice Sessions</span>
          <span><b>4.9/5</b> User Rating</span>
          <span><b>150+</b> Countries</span>
        </div>
      </section>

      <footer className="marketing-footer">
        <Image alt="QuesIQ" height={48} src="/brand/quesiq-main-logo.png" width={150} />
        <nav aria-label="Footer">
          <Link href="/login?next=/interview">Interview</Link>
          <Link href="/login?next=/study">Study</Link>
          <Link href="/apps">Apps</Link>
          <Link href="/create-account">Create Account</Link>
          <Link href="/account">Account</Link>
        </nav>
      </footer>
      <MarketingQuiraLauncher />
    </main>
  );
}
