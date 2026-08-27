"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AudioWaveform,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Captions,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  FileJson,
  Headphones,
  History,
  Home,
  Mic,
  Mic2,
  PhoneOff,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import styles from "./mobile-preview-lab.module.css";

type PreviewScreen = "home" | "practice" | "session" | "review" | "me";
type DeviceKind = "iphone" | "pixel";
type InspectorTab = "plan" | "prompts" | "runs";

type RuntimeConfig = {
  enabled: boolean;
  engine: "realtime" | "turn_based";
  feedbackDepth: string;
  maxAnswerSeconds: number;
  maxDurationSeconds: number;
  maxTurns: number;
  modeKey: string;
  textModel: string;
  ttsVoice: string;
};

type PromptWorkspaceAction = {
  blocks: Array<{ body: string; meta?: string; title: string }>;
  description: string;
  key: string;
  modeKey?: string;
  title: string;
};

type InspectionAiRun = {
  durationMs?: number;
  estimatedCostMicroUsd?: number;
  id: string;
  inputTokens?: number;
  model: string;
  outputTokens?: number;
  promptConfigKey?: string;
  promptConfigVersion?: number;
  promptSnapshot?: string;
  rawJson?: Record<string, unknown>;
  runType: string;
  startedAt: string;
  status: string;
};

type InspectionRun = {
  aiRuns: InspectionAiRun[];
  contextSnapshot: {
    interviewContext: {
      preferredName: string;
      targetCompany: string;
      targetRole: string;
    };
  };
  createdAt: string;
  engine: "realtime" | "turn_based";
  evaluationStatus: string;
  id: string;
  modeKey: string;
  runtime: { model?: string; voice?: string };
  status: string;
  transcript: Array<{ role: "assistant" | "user"; speaker: string; text: string }>;
  turns: Array<{
    answerTranscript?: string;
    feedback?: string;
    question: string;
    routingReason: string;
    targetSkill: string;
    turnIndex: number;
  }>;
};

const modeKeys: Record<string, "coaching" | "mock_interview" | "rapid_fire"> = {
  Coaching: "coaching",
  "Mock Interview": "mock_interview",
  "Rapid Fire": "rapid_fire",
};

const screens: { Icon: LucideIcon; key: PreviewScreen; label: string }[] = [
  { Icon: Home, key: "home", label: "Home" },
  { Icon: Mic2, key: "practice", label: "Practice" },
  { Icon: Radio, key: "session", label: "Live Session" },
  { Icon: Target, key: "review", label: "Review" },
  { Icon: UserRound, key: "me", label: "Me" },
];

const tabItems: { Icon: LucideIcon; key: Exclude<PreviewScreen, "session" | "review"> | "history"; label: string }[] = [
  { Icon: Home, key: "home", label: "Home" },
  { Icon: Mic2, key: "practice", label: "Practice" },
  { Icon: History, key: "history", label: "History" },
  { Icon: UserRound, key: "me", label: "Me" },
];

export function MobilePreviewLab() {
  const [screen, setScreen] = useState<PreviewScreen>("practice");
  const [scale, setScale] = useState<"compact" | "full">("compact");
  const [showTranscript, setShowTranscript] = useState(false);
  const [mode, setMode] = useState("Coaching");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("plan");
  const [lastAction, setLastAction] = useState("Coaching selected in Practice");

  function changeScreen(nextScreen: PreviewScreen) {
    setScreen(nextScreen);
    setLastAction(
      nextScreen === "session"
        ? `Start answer clicked · ${mode} launch path selected`
        : nextScreen === "review"
          ? "End session clicked · artifact save and evaluation path selected"
          : `${nextScreen[0].toUpperCase()}${nextScreen.slice(1)} screen selected`,
    );
  }

  function changeMode(nextMode: string) {
    setMode(nextMode);
    setLastAction(`${nextMode} selected in Practice`);
  }

  function selectTab(key: (typeof tabItems)[number]["key"]) {
    changeScreen(key === "history" ? "review" : key);
  }

  return (
    <main className={styles.lab}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarCopy}>
          <Link className={styles.backLink} href="/interview">
            <ArrowLeft aria-hidden="true" />
            Interview fallback
          </Link>
          <div className={styles.titleRow}>
            <div>
              <p className={styles.eyebrow}>LOCAL DESIGN WORKBENCH</p>
              <h1>QuesIQ mobile preview</h1>
            </div>
            <span className={styles.previewBadge}><Eye aria-hidden="true" /> Visual preview only</span>
          </div>
          <p className={styles.intro}>Review the same app state on iPhone and Pixel proportions. Changes here are for layout and interaction review; native microphone proof still runs in the Expo development build.</p>
        </div>
        <div className={styles.controls} aria-label="Preview controls">
          <div className={styles.screenPicker} aria-label="Preview screen">
            {screens.map(({ Icon, key, label }) => (
              <button aria-pressed={screen === key} className={screen === key ? styles.controlActive : undefined} key={key} onClick={() => changeScreen(key)} type="button">
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className={styles.sizePicker} aria-label="Preview size">
            <button aria-pressed={scale === "compact"} className={scale === "compact" ? styles.controlActive : undefined} onClick={() => setScale("compact")} type="button">Fit</button>
            <button aria-pressed={scale === "full"} className={scale === "full" ? styles.controlActive : undefined} onClick={() => setScale("full")} type="button">Actual size</button>
            <button aria-label="Reset preview" onClick={() => { setScreen("practice"); setMode("Coaching"); setShowTranscript(false); setInspectorTab("plan"); setLastAction("Coaching selected in Practice"); }} type="button"><RotateCcw aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      <BackendInspector
        activeTab={inspectorTab}
        lastAction={lastAction}
        mode={mode}
        onMode={changeMode}
        onTab={setInspectorTab}
        screen={screen}
      />

      <section className={`${styles.deviceStage} ${scale === "full" ? styles.deviceStageFull : ""}`} aria-label="Mobile device previews">
        <DevicePreview device="iphone" mode={mode} onMode={changeMode} onScreen={changeScreen} onTab={selectTab} screen={screen} showTranscript={showTranscript} onTranscript={setShowTranscript} />
        <DevicePreview device="pixel" mode={mode} onMode={changeMode} onScreen={changeScreen} onTab={selectTab} screen={screen} showTranscript={showTranscript} onTranscript={setShowTranscript} />
      </section>
    </main>
  );
}

function BackendInspector({ activeTab, lastAction, mode, onMode, onTab, screen }: {
  activeTab: InspectorTab;
  lastAction: string;
  mode: string;
  onMode: (mode: string) => void;
  onTab: (tab: InspectorTab) => void;
  screen: PreviewScreen;
}) {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>();
  const [promptActions, setPromptActions] = useState<PromptWorkspaceAction[]>([]);
  const [runs, setRuns] = useState<InspectionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const modeKey = modeKeys[mode];

  useEffect(() => {
    const controller = new AbortController();
    async function loadInspector() {
      setLoading(true);
      setError(undefined);
      try {
        const [runtimeResponse, promptsResponse, runsResponse] = await Promise.all([
          fetch(`/api/interview/runtime-config?modeKey=${modeKey}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/interview/prompt-workspace", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/admin/interview/inspection-runs?limit=50", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        if (!runtimeResponse.ok || !promptsResponse.ok || !runsResponse.ok) {
          throw new Error(
            promptsResponse.status === 403 || runsResponse.status === 403
              ? "Admin access is required to inspect prompts and saved runs."
              : "The local inspector APIs did not all respond successfully.",
          );
        }
        const runtimeBody = (await runtimeResponse.json()) as { config: RuntimeConfig };
        const promptBody = (await promptsResponse.json()) as { actions: PromptWorkspaceAction[] };
        const runsBody = (await runsResponse.json()) as { runs: InspectionRun[] };
        setRuntimeConfig(runtimeBody.config);
        setPromptActions(promptBody.actions);
        setRuns(runsBody.runs);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Backend Inspector could not load.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadInspector();
    return () => controller.abort();
  }, [modeKey, refreshKey]);

  const promptAction = promptActions.find((action) => action.modeKey === modeKey);
  const matchingRuns = runs.filter((run) => run.modeKey === modeKey);
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const engine = runtimeConfig?.engine ?? (modeKey === "mock_interview" ? "realtime" : "turn_based");
  const pipeline = engine === "realtime"
    ? [
        "Create owned session",
        "Request native microphone",
        "Exchange WebRTC SDP through server",
        "Que speaks + transcript events arrive",
        "Save transcript artifact",
        "Evaluate and reopen review",
      ]
    : [
        "Create owned session",
        "Resolve prompt layers + candidate context",
        "Generate one structured question",
        "Capture answer transcript",
        "Generate coaching + next route",
        "Save turns, evaluate, reopen review",
      ];

  return <section className={styles.inspector} aria-label="Backend Inspector">
    <div className={styles.inspectorHeader}>
      <div>
        <p className={styles.eyebrow}>CLICK-DRIVEN TRACE</p>
        <h2><Activity aria-hidden="true" />Backend Inspector</h2>
        <p>Phone clicks update the planned path. Saved Runs shows the actual database record from a real Interview session.</p>
      </div>
      <div className={styles.inspectorActions}>
        <span><Database aria-hidden="true" />Local Postgres</span>
        <button disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} type="button"><RefreshCw aria-hidden="true" />Refresh</button>
        <a href="/api/admin/interview/inspection-runs/export"><Download aria-hidden="true" />Export CSV</a>
      </div>
    </div>

    <div className={styles.inspectorModeBar} aria-label="Inspected mode">
      {Object.keys(modeKeys).map((candidate) => <button aria-pressed={mode === candidate} className={mode === candidate ? styles.inspectorModeActive : undefined} key={candidate} onClick={() => onMode(candidate)} type="button">{candidate}</button>)}
      <span>{lastAction}</span>
    </div>

    <div className={styles.inspectorTabs} role="tablist" aria-label="Inspector views">
      <button aria-selected={activeTab === "plan"} className={activeTab === "plan" ? styles.inspectorTabActive : undefined} onClick={() => onTab("plan")} role="tab" type="button"><Activity aria-hidden="true" />What will happen</button>
      <button aria-selected={activeTab === "prompts"} className={activeTab === "prompts" ? styles.inspectorTabActive : undefined} onClick={() => onTab("prompts")} role="tab" type="button"><FileJson aria-hidden="true" />Prompt stack</button>
      <button aria-selected={activeTab === "runs"} className={activeTab === "runs" ? styles.inspectorTabActive : undefined} onClick={() => onTab("runs")} role="tab" type="button"><Database aria-hidden="true" />Saved runs <span>{matchingRuns.length}</span></button>
    </div>

    {error ? <div className={styles.inspectorError}>{error}</div> : null}

    {activeTab === "plan" ? <div className={styles.planGrid}>
      <section className={styles.runtimeCard}>
        <p className={styles.inspectorKicker}>CURRENT PREVIEW ACTION</p>
        <h3>{lastAction}</h3>
        <dl>
          <div><dt>Preview screen</dt><dd>{screen}</dd></div>
          <div><dt>Mode key</dt><dd>{modeKey}</dd></div>
          <div><dt>Engine</dt><dd>{engine.replace("_", " ")}</dd></div>
          <div><dt>Model</dt><dd>{runtimeConfig?.textModel ?? "Loading…"}</dd></div>
          <div><dt>Voice</dt><dd>{runtimeConfig?.ttsVoice ?? "Loading…"}</dd></div>
          <div><dt>Limits</dt><dd>{runtimeConfig ? `${runtimeConfig.maxTurns} turns · ${runtimeConfig.maxAnswerSeconds}s answers` : "Loading…"}</dd></div>
        </dl>
      </section>
      <section className={styles.pipelineCard}>
        <p className={styles.inspectorKicker}>RUNTIME PIPELINE</p>
        <ol>{pipeline.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}</ol>
      </section>
      <aside className={styles.truthCard}>
        <strong>Preview versus proof</strong>
        <p>This phone preview does not call OpenAI or write a session. It explains the path selected by each click.</p>
        <p>A real web or native practice session automatically appears under Saved Runs with its questions, answers, prompts, model, response trace, and evaluation state.</p>
      </aside>
    </div> : null}

    {activeTab === "prompts" ? <div className={styles.promptPanel}>
      <div className={styles.promptIntro}>
        <div><p className={styles.inspectorKicker}>ACTIVE STACK</p><h3>{promptAction?.title ?? mode}</h3></div>
        <p>{promptAction?.description ?? (loading ? "Loading the active prompt workspace…" : "No active prompt workspace entry was found.")}</p>
      </div>
      <div className={styles.promptBlocks}>
        {promptAction?.blocks.map((block) => <details key={`${promptAction.key}-${block.title}`} open={block.title === "Mode Instructions" || block.title === "Runtime Context Preview"}>
          <summary><span>{block.title}</span><small>{block.meta}</small></summary>
          <pre>{block.body}</pre>
        </details>)}
      </div>
      <p className={styles.privacyNote}>Prompt previews may contain local resume and job-target context. They remain behind the admin session and are not included in the CSV export.</p>
    </div> : null}

    {activeTab === "runs" ? <div className={styles.runsPanel}>
      <div className={styles.runsHeading}><div><p className={styles.inspectorKicker}>ACTUAL PERSISTED TRACE</p><h3>{mode} sessions</h3></div><p>Newest first · click a row to inspect the complete saved trace.</p></div>
      {matchingRuns.length === 0 ? <div className={styles.emptyRuns}>{loading ? "Loading saved sessions…" : `No saved ${mode} session is in the local ledger yet.`}</div> : <div className={styles.tableWrap}><table>
        <thead><tr><th>Started</th><th>Target</th><th>Status</th><th>Turns</th><th>Model</th><th>Trace</th></tr></thead>
        <tbody>{matchingRuns.map((run) => <tr key={run.id} onClick={() => setSelectedRunId(run.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedRunId(run.id); }}>
          <td>{new Date(run.createdAt).toLocaleString()}</td>
          <td><strong>{run.contextSnapshot.interviewContext.targetRole || "General practice"}</strong><small>{run.contextSnapshot.interviewContext.targetCompany || "No company"}</small></td>
          <td><span className={run.evaluationStatus === "completed" ? styles.runSuccess : styles.runStatus}>{run.evaluationStatus.replace("_", " ")}</span></td>
          <td>{run.turns.length || run.transcript.length}</td>
          <td>{run.runtime.model ?? run.aiRuns[0]?.model ?? "—"}</td>
          <td><button onClick={(event) => { event.stopPropagation(); setSelectedRunId(run.id); }} type="button">Inspect</button></td>
        </tr>)}</tbody>
      </table></div>}
      {selectedRun ? <ActualTrace run={selectedRun} onClose={() => setSelectedRunId(undefined)} /> : null}
    </div> : null}
  </section>;
}

function ActualTrace({ onClose, run }: { onClose: () => void; run: InspectionRun }) {
  return <aside className={styles.traceDrawer} aria-label="Actual saved trace">
    <div className={styles.traceHeader}><div><p className={styles.inspectorKicker}>SESSION {run.id.slice(0, 8)}</p><h3>Actual saved trace</h3></div><button onClick={onClose} type="button">Close</button></div>
    <div className={styles.traceSummary}>
      <span>{run.modeKey.replaceAll("_", " ")}</span><span>{run.engine.replace("_", " ")}</span><span>{run.status}</span><span>{run.evaluationStatus.replace("_", " ")}</span>
    </div>
    <section className={styles.traceConversation}>
      <h4>Question and response record</h4>
      {run.turns.length > 0 ? run.turns.map((turn) => <article key={turn.turnIndex}>
        <small>Turn {turn.turnIndex} · {turn.targetSkill || "general"}</small>
        <p><strong>Que</strong>{turn.question}</p>
        <p><strong>You</strong>{turn.answerTranscript || "No answer saved"}</p>
        {turn.feedback ? <p><strong>Feedback</strong>{turn.feedback}</p> : null}
        {turn.routingReason ? <p><strong>Routing</strong>{turn.routingReason}</p> : null}
      </article>) : run.transcript.map((turn, index) => <article key={`${turn.role}-${index}`}><p><strong>{turn.speaker}</strong>{turn.text}</p></article>)}
    </section>
    <section className={styles.traceAiRuns}>
      <h4>AI request and response trace</h4>
      {run.aiRuns.map((aiRun) => <details key={aiRun.id}>
        <summary><span>{aiRun.runType.replaceAll("_", " ")} · {aiRun.model}</span><small>{aiRun.status} · {aiRun.durationMs ?? 0} ms</small></summary>
        <dl><div><dt>Prompt config</dt><dd>{aiRun.promptConfigKey ? `${aiRun.promptConfigKey} v${aiRun.promptConfigVersion ?? "?"}` : "Composed runtime prompt"}</dd></div><div><dt>Tokens</dt><dd>{aiRun.inputTokens ?? 0} in · {aiRun.outputTokens ?? 0} out</dd></div><div><dt>Estimated cost</dt><dd>{aiRun.estimatedCostMicroUsd ? `${aiRun.estimatedCostMicroUsd} micro-USD` : "Unavailable"}</dd></div></dl>
        {aiRun.promptSnapshot ? <details><summary>Exact resolved prompt</summary><pre>{aiRun.promptSnapshot}</pre></details> : null}
        {aiRun.rawJson ? <details><summary>Request / response metadata</summary><pre>{JSON.stringify(aiRun.rawJson, null, 2)}</pre></details> : null}
      </details>)}
    </section>
  </aside>;
}

function DevicePreview({ device, mode, onMode, onScreen, onTab, onTranscript, screen, showTranscript }: {
  device: DeviceKind;
  mode: string;
  onMode: (mode: string) => void;
  onScreen: (screen: PreviewScreen) => void;
  onTab: (key: (typeof tabItems)[number]["key"]) => void;
  onTranscript: (show: boolean) => void;
  screen: PreviewScreen;
  showTranscript: boolean;
}) {
  const name = device === "iphone" ? "iPhone 16 Pro" : "Pixel 9";
  return (
    <article className={styles.deviceColumn}>
      <div className={styles.deviceLabel}><span>{name}</span><span>{device === "iphone" ? "393 × 852" : "412 × 915"}</span></div>
      <div className={`${styles.device} ${device === "iphone" ? styles.iphone : styles.pixel}`}>
        <div className={styles.deviceScreen}>
          <StatusBar device={device} />
          <div className={styles.appViewport}>
            {screen === "home" && <HomeScreen onScreen={onScreen} />}
            {screen === "practice" && <PracticeScreen mode={mode} onMode={onMode} onScreen={onScreen} />}
            {screen === "session" && <SessionScreen onScreen={onScreen} />}
            {screen === "review" && <ReviewScreen onScreen={onScreen} onTranscript={onTranscript} showTranscript={showTranscript} />}
            {screen === "me" && <MeScreen />}
          </div>
          {screen !== "session" && screen !== "review" ? <MobileTabs active={screen} onTab={onTab} /> : null}
          <div className={styles.homeIndicator} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function StatusBar({ device }: { device: DeviceKind }) {
  return <div aria-label={`${device} status bar`} className={styles.statusBar}><span>9:41</span><span>5G&nbsp;&nbsp;92%</span></div>;
}

function MobileHeader({ eyebrow, subtitle, title }: { eyebrow: string; subtitle?: string; title: string }) {
  return <header className={styles.mobileHeader}><p className={styles.mobileEyebrow}>{eyebrow}</p><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</header>;
}

function HomeScreen({ onScreen }: { onScreen: (screen: PreviewScreen) => void }) {
  return <div className={styles.mobilePage}>
    <MobileHeader eyebrow="QuesIQ Interview" subtitle="One focused conversation at a time." title="Ready, Ronnie?" />
    <section className={`${styles.mobileCard} ${styles.cyanCard}`}>
      <div className={styles.cardLead}><span className={styles.iconTile}><Sparkles aria-hidden="true" /></span><div><p className={styles.mobileEyebrow}>QUICK PRACTICE</p><h3>Make your first 90 seconds count.</h3><p>Que will help you sharpen your introduction for this role.</p></div></div>
      <MobileButton Icon={ArrowRight} label="Start First Impression" onClick={() => onScreen("practice")} />
    </section>
    <section className={styles.mobileCard}>
      <div className={styles.cardTitle}><strong>Active target</strong><BriefcaseBusiness aria-hidden="true" className={styles.limeIcon} /></div>
      <h3>First Officer</h3><p>NetJets Aviation</p>
    </section>
    <div className={styles.metricGrid}><section className={`${styles.mobileCard} ${styles.limeCard}`}><Target aria-hidden="true" className={styles.limeIcon} /><strong className={styles.metric}>84%</strong><span>Latest score</span></section><section className={styles.mobileCard}><Clock3 aria-hidden="true" /><strong className={styles.metric}>12</strong><span>Saved sessions</span></section></div>
    <button className={styles.reviewLink} onClick={() => onScreen("review")} type="button"><span><strong>Continue your progress</strong><small>Make your results more specific and measurable.</small></span><ArrowRight aria-hidden="true" /></button>
  </div>;
}

function PracticeScreen({ mode, onMode, onScreen }: { mode: string; onMode: (mode: string) => void; onScreen: (screen: PreviewScreen) => void }) {
  const modes: { Icon: LucideIcon; label: string; value: string }[] = [
    { Icon: Headphones, label: "Coaching", value: "Coaching" },
    { Icon: Zap, label: "Rapid Fire", value: "Rapid Fire" },
    { Icon: Users, label: "Mock", value: "Mock Interview" },
  ];
  return <div className={`${styles.mobilePage} ${styles.voiceDeckPage}`}>
    <header className={styles.voiceDeckHeader}>
      <div className={styles.voiceDeckBrand}>
        <Image alt="" aria-hidden="true" className={styles.voiceDeckLogo} height={48} src="/brand/quesiq-icon.png" width={48} />
        <strong>Interview</strong>
      </div>
      <button aria-label="Open profile" className={styles.profileBadge} onClick={() => onScreen("me")} type="button"><span>RW</span><i /></button>
    </header>

    <button className={styles.voiceTarget} onClick={() => onScreen("me")} type="button">
      <BriefcaseBusiness aria-hidden="true" />
      <span><strong>First Officer</strong> · NetJets Aviation</span>
      <ChevronRight aria-hidden="true" />
    </button>

    <div className={styles.voiceModes} aria-label="Interview mode">
      {modes.map(({ Icon, label, value }) => <button aria-pressed={mode === value} className={mode === value ? styles.voiceModeActive : undefined} key={value} onClick={() => onMode(value)} type="button"><Icon aria-hidden="true" /><span>{label}</span></button>)}
    </div>

    <section className={styles.voicePrompt}>
      <p>Recommended question</p>
      <h2>How do you lead a team through unexpected change?</h2>
      <div className={styles.voiceWaveform}>
        <AudioWaveform aria-hidden="true" className={styles.voiceWaveLeft} />
        <button aria-label="Start answering" className={styles.voiceMic} onClick={() => onScreen("session")} type="button"><Mic aria-hidden="true" /></button>
        <AudioWaveform aria-hidden="true" className={styles.voiceWaveRight} />
      </div>
      <span>Hold or tap to answer</span>
    </section>

    <button className={styles.voiceStart} onClick={() => onScreen("session")} type="button"><Mic aria-hidden="true" />Start answer</button>

    <div className={styles.voicePerformance}>
      <span><TrendingUp aria-hidden="true" /></span>
      <p>Recent performance<strong>Clarity <em>4.2</em> · Confidence <em>3.8</em></strong></p>
    </div>
  </div>;
}

function SessionScreen({ onScreen }: { onScreen: (screen: PreviewScreen) => void }) {
  return <div className={`${styles.mobilePage} ${styles.sessionPage}`}>
    <div className={styles.sessionTop}><span><i />Que is listening</span><strong>02:14</strong></div>
    <div className={styles.sessionCenter}><div className={styles.voiceOrb}><Radio aria-hidden="true" /></div><strong>QUE</strong><p>Speak naturally. Que will respond when you finish your thought.</p></div>
    <div className={styles.captionPanel}><span>LIVE CAPTIONS</span><p><strong>Que:</strong> Tell me about a time you made a difficult decision under pressure.</p><p><strong>You:</strong> During a high-tempo operational assignment…</p></div>
    <div className={styles.sessionControls}><button aria-label="Mute microphone" type="button"><Mic aria-hidden="true" /></button><button aria-label="Hide captions" type="button"><Captions aria-hidden="true" /></button></div>
    <button className={styles.endButton} onClick={() => onScreen("review")} type="button"><PhoneOff aria-hidden="true" />End session</button>
  </div>;
}

function ReviewScreen({ onScreen, onTranscript, showTranscript }: { onScreen: (screen: PreviewScreen) => void; onTranscript: (show: boolean) => void; showTranscript: boolean }) {
  const scores = [["Confidence", 4], ["Clarity", 4], ["Relevance", 5], ["Impact", 3], ["Authenticity", 5]] as const;
  return <div className={styles.mobilePage}>
    <button aria-label="Back to history" className={styles.mobileBack} onClick={() => onScreen("home")} type="button"><ArrowLeft aria-hidden="true" /></button>
    <MobileHeader eyebrow="Saved review" title="First Officer" />
    <section className={`${styles.mobileCard} ${styles.limeCard}`}><div className={styles.scoreRow}><strong>84</strong><span><b>/ 100</b><small>Overall interview score</small></span></div></section>
    <section className={styles.mobileCard}><strong>Coach summary</strong><p>Your answers sound confident and grounded in real experience.</p><p className={styles.limeText}>Next, make the result of each example more specific and measurable.</p></section>
    <section className={styles.mobileCard}><strong>Five dimensions</strong>{scores.map(([label, score]) => <div className={styles.scoreItem} key={label}><div><span>{label}</span><b>{score}/5</b></div><i><span style={{ width: `${score * 20}%` }} /></i></div>)}</section>
    <section className={styles.mobileCard}><button className={styles.transcriptToggle} onClick={() => onTranscript(!showTranscript)} type="button"><strong>Transcript · 6 turns</strong><ChevronDown aria-hidden="true" className={showTranscript ? styles.chevronOpen : undefined} /></button>{showTranscript ? <div className={styles.transcript}><p><strong>Que</strong> Tell me about a difficult decision you made under pressure.</p><p><strong>You</strong> During a high-tempo operational assignment, I had to balance mission timing with a changing risk picture.</p></div> : null}</section>
  </div>;
}

function MeScreen() {
  return <div className={styles.mobilePage}>
    <MobileHeader eyebrow="Your setup" subtitle="ronnie@example.com" title="Me" />
    <section className={styles.mobileCard}><strong>Interview profile</strong><label>Preferred name<input defaultValue="Ronnie" /></label><label>Target role<input defaultValue="First Officer" /></label><label>Company<input defaultValue="NetJets Aviation" /></label><label>Job description<textarea defaultValue="Safety-focused flight operations, sound judgment, and exceptional passenger service." /></label><MobileButton Icon={Save} label="Save profile" /></section>
    <section className={styles.mobileCard}><strong>Resume</strong><p>Ready: Ronnie_Weeks_Resume.pdf</p></section>
  </div>;
}

function MobileButton({ Icon, label, onClick }: { Icon?: LucideIcon; label: string; onClick?: () => void }) {
  return <button className={styles.mobilePrimary} onClick={onClick} type="button">{Icon ? <Icon aria-hidden="true" /> : null}{label}</button>;
}

function MobileTabs({ active, onTab }: { active: PreviewScreen; onTab: (key: (typeof tabItems)[number]["key"]) => void }) {
  return <nav className={styles.mobileTabs} aria-label="Mobile preview navigation">{tabItems.map(({ Icon, key, label }) => { const current = active === key || (key === "history" && active === "review"); return <button aria-current={current ? "page" : undefined} className={current ? styles.mobileTabActive : undefined} key={key} onClick={() => onTab(key)} type="button"><Icon aria-hidden="true" /><span>{label}</span></button>; })}</nav>;
}
