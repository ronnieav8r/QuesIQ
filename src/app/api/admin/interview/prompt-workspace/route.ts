import { NextResponse } from "next/server";

import type {
  PromptComponentRecord,
  PromptConfigKey,
  PromptConfigRecord,
  SessionSetupSnapshot,
} from "@/product/interview-types";
import { requireAdminSession } from "@/server/admin";
import { listPromptComponents } from "@/server/catalog/prompt-components";
import { buildTurnSystemPrompt, buildTurnTaskInstruction } from "@/server/interview/turn-based";
import { listPromptConfigs } from "@/server/prompts/prompt-configs";

export const runtime = "nodejs";

type WorkspaceActionKey =
  | "coaching"
  | "debrief"
  | "evaluation"
  | "introduction_builder"
  | "mock_interview"
  | "rapid_fire"
  | "story_lab"
  | "tmaat_story";

type WorkspaceBlock = {
  body: string;
  collapsed?: boolean;
  editable?: {
    key: string;
    kind: "component" | "prompt_config";
    target?: PromptConfigRecord["target"];
    type?: PromptComponentRecord["type"];
  };
  meta?: string;
  readOnly?: boolean;
  title: string;
};

type WorkspaceAction = {
  blocks: WorkspaceBlock[];
  description: string;
  key: WorkspaceActionKey;
  modeKey?: SessionSetupSnapshot["modeKey"];
  testTunnel?: {
    endpoint?: "/api/realtime/debrief" | "/api/realtime/session" | "/api/realtime/story";
    mode: "coaching" | "first_impression" | "mock_interview" | "rapid_fire";
  };
  title: string;
};

const actionDefinitions: Array<{
  basePromptKeys: PromptConfigKey[];
  description: string;
  key: WorkspaceActionKey;
  modeKey?: SessionSetupSnapshot["modeKey"];
  questionTypeKey?: SessionSetupSnapshot["questionTypeKey"];
  styleKey?: SessionSetupSnapshot["styleKey"];
  testTunnel?: WorkspaceAction["testTunnel"];
  title: string;
}> = [
  {
    basePromptKeys: ["session_evaluation"],
    description: "Turn-based coaching next-turn prompts, role context, story memory context, and review prompts.",
    key: "coaching",
    modeKey: "coaching",
    questionTypeKey: "behavioral",
    styleKey: "friendly",
    testTunnel: { mode: "coaching" },
    title: "Coaching",
  },
  {
    basePromptKeys: ["session_evaluation"],
    description: "Turn-based rapid-fire next-turn prompts, archetype routing, and final review prompts.",
    key: "rapid_fire",
    modeKey: "rapid_fire",
    questionTypeKey: "behavioral",
    styleKey: "neutral",
    testTunnel: { mode: "rapid_fire" },
    title: "Rapid Fire",
  },
  {
    basePromptKeys: ["realtime_interviewer", "session_evaluation"],
    description: "True Realtime mock interview prompt stack plus post-session evaluation.",
    key: "mock_interview",
    modeKey: "mock_interview",
    questionTypeKey: "behavioral",
    styleKey: "neutral",
    testTunnel: { endpoint: "/api/realtime/session", mode: "mock_interview" },
    title: "Mock Interview",
  },
  {
    basePromptKeys: [
      "story_conversation_realtime",
      "story_follow_up",
      "story_outline",
      "story_practice_realtime",
      "story_practice_evaluation",
    ],
    description: "Story Lab capture, follow-up, outline, practice, and story-specific evaluation prompts.",
    key: "story_lab",
    modeKey: "coaching",
    questionTypeKey: "behavioral",
    styleKey: "friendly",
    testTunnel: { endpoint: "/api/realtime/story", mode: "coaching" },
    title: "Story Lab",
  },
  {
    basePromptKeys: [
      "story_conversation_realtime",
      "introduction_draft",
      "session_evaluation",
    ],
    description: "Introduction capture, draft generation, saved-introduction practice, and evaluation prompts.",
    key: "introduction_builder",
    modeKey: "first_impression",
    styleKey: "friendly",
    testTunnel: { mode: "first_impression" },
    title: "Introduction Builder",
  },
  {
    basePromptKeys: [
      "story_conversation_realtime",
      "story_follow_up",
      "story_outline",
      "story_practice_evaluation",
    ],
    description: "Tell Me About a Time capture, follow-up, outline, practice context, and story evaluation prompts.",
    key: "tmaat_story",
    modeKey: "coaching",
    questionTypeKey: "behavioral",
    styleKey: "friendly",
    testTunnel: { mode: "coaching" },
    title: "TMAAT Story",
  },
  {
    basePromptKeys: ["session_evaluation", "story_practice_evaluation"],
    description: "Written post-session review prompt, schema expectations, mode-specific rules, and scoring context.",
    key: "evaluation",
    modeKey: "coaching",
    questionTypeKey: "behavioral",
    styleKey: "neutral",
    title: "Post-Session Review",
  },
  {
    basePromptKeys: ["session_debrief"],
    description: "Live voice debrief prompt, compact review card, and static opener behavior.",
    key: "debrief",
    testTunnel: { endpoint: "/api/realtime/debrief", mode: "mock_interview" },
    title: "Voice Debrief",
  },
];

function activeConfig(configs: PromptConfigRecord[], key: PromptConfigKey) {
  return (
    configs.find((config) => config.key === key && config.active) ||
    configs.find((config) => config.key === key)
  );
}

function component(
  components: PromptComponentRecord[],
  type: PromptComponentRecord["type"],
  key?: string,
) {
  if (!key) return undefined;
  return components.find((item) => item.type === type && item.key === key);
}

function blockFromConfig(config?: PromptConfigRecord): WorkspaceBlock | undefined {
  if (!config) return undefined;

  return {
    body: config.instructions,
    collapsed: true,
    editable: {
      key: config.key,
      kind: "prompt_config",
      target: config.target,
    },
    meta: `key ${config.key} · v${config.version} · ${config.active ? "active" : "inactive"} · model ${config.model}${config.voice ? ` · voice ${config.voice}` : ""}`,
    title: config.name,
  };
}

function blockFromComponent(
  item: PromptComponentRecord | undefined,
  fallbackTitle: string,
): WorkspaceBlock | undefined {
  if (!item) return undefined;

  return {
    body: item.promptInstructions,
    collapsed: true,
    editable: {
      key: item.key,
      kind: "component",
      type: item.type,
    },
    meta: `${item.type} · ${item.key}`,
    title: fallbackTitle,
  };
}

function sampleSnapshot(definition: (typeof actionDefinitions)[number]): SessionSetupSnapshot {
  return {
    interviewContext: {
      jobDescription: "Sample admin preview job description. Actual sessions use the user's saved target and uploaded context.",
      preferredName: "Admin Preview",
      resumeText: "Sample resume excerpt. Actual sessions use parsed user resume context when available.",
      targetCompany: "Sample Company",
      targetRole: "Sample Role",
    },
    modeKey: definition.modeKey ?? "coaching",
    questionTypeKey: definition.questionTypeKey,
    styleKey: definition.styleKey ?? "friendly",
    turnBasedQuestionCount: definition.modeKey === "rapid_fire" ? 4 : 3,
  };
}

function runtimeContextBlock(definition: (typeof actionDefinitions)[number]): WorkspaceBlock {
  const context = {
    coachingMemory: "Loaded from the signed-in user's coaching memory when available.",
    jobDescription: "User saved job target/job description.",
    priorTurns: "Latest transcript turns for turn-based modes.",
    resumeContext: "Parsed resume excerpt when available.",
    savedIntroduction: definition.key === "introduction_builder" ? "Saved introduction fields and script during introduction practice." : undefined,
    savedStory: definition.key === "story_lab" || definition.key === "tmaat_story" ? "Saved story outline, selected spin, categories, and coach notes during story practice." : undefined,
    storyLibrary: "Saved story library context when relevant to coaching/mock interview.",
    targetCompany: "User saved target company.",
    targetRole: "User saved target role.",
  };

  return {
    body: JSON.stringify(context, null, 2),
    collapsed: true,
    readOnly: true,
    title: "Runtime Context",
  };
}

function generatedBlocks(definition: (typeof actionDefinitions)[number]): WorkspaceBlock[] {
  const blocks: WorkspaceBlock[] = [];

  if (definition.modeKey === "coaching" || definition.modeKey === "rapid_fire" || definition.modeKey === "first_impression") {
    const snapshot = sampleSnapshot(definition);
    blocks.push({
      body: buildTurnSystemPrompt(snapshot.modeKey),
      collapsed: true,
      readOnly: true,
      title: "Generated System Rules",
    });
    blocks.push({
      body: buildTurnTaskInstruction(snapshot, false, true, false),
      collapsed: true,
      readOnly: true,
      title: "Generated Turn Task",
    });
  }

  if (definition.key === "mock_interview") {
    blocks.push({
      body: [
        "Realtime runtime composes the active realtime_interviewer prompt with mode, question-focus, style, story/introduction context when present, story library, target role/company, resume excerpt, coaching memory, and strict spoken-turn contract.",
        "The client first-turn instruction starts the live voice session and asks exactly one opening question.",
      ].join("\n"),
      collapsed: true,
      readOnly: true,
      title: "Generated Realtime Assembly",
    });
  }

  if (definition.key === "debrief") {
    blocks.push({
      body: JSON.stringify(
        {
          debrief_intent: "open_review | score_explanation | what_to_improve_first | practice_fix",
          recommended_next_action: "One next practice action from the written review.",
          review_evidence: "No more than 2-3 compact evidence points.",
          star_diagnosis: "Strongest/weakest STAR area and reason.",
          transcript_excerpt: "Last relevant transcript turns.",
          user_question: "Only present when the user asks a debrief question.",
        },
        null,
        2,
      ),
      collapsed: true,
      readOnly: true,
      title: "Generated Debrief Card",
    });
  }

  if (definition.key === "evaluation") {
    blocks.push({
      body: [
        "API structured output schema requires summary, coachingInsight, nextAction, five score objects, reviewDetail, and coachingMemory.",
        "Current score keys: confidence, clarity, relevance, impact, authenticity.",
        "Mode-specific evaluation instructions are added for Rapid Fire, Coaching, Story Practice, and Introduction Practice when context is present.",
      ].join("\n"),
      collapsed: true,
      readOnly: true,
      title: "Generated Evaluation Schema Rules",
    });
  }

  return blocks;
}

function finalPreview(blocks: WorkspaceBlock[]) {
  return blocks
    .map((block) => [`## ${block.title}`, block.meta, block.body].filter(Boolean).join("\n"))
    .join("\n\n");
}

export async function GET(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const styleKey = url.searchParams.get("styleKey")?.trim() || undefined;
    const questionTypeKey = url.searchParams.get("questionTypeKey")?.trim() || undefined;
    const [configs, components] = await Promise.all([
      listPromptConfigs(),
      listPromptComponents(),
    ]);
    const styleKeys = new Set(
      components
        .filter((item) => item.type === "style")
        .map((item) => item.key),
    );
    const questionTypeKeys = new Set(
      components
        .filter((item) => item.type === "question_type")
        .map((item) => item.key),
    );
    const selectedStyleKey: SessionSetupSnapshot["styleKey"] | undefined =
      styleKey && styleKeys.has(styleKey)
        ? (styleKey as SessionSetupSnapshot["styleKey"])
        : undefined;
    const selectedQuestionTypeKey: SessionSetupSnapshot["questionTypeKey"] | undefined =
      questionTypeKey && questionTypeKeys.has(questionTypeKey)
        ? (questionTypeKey as SessionSetupSnapshot["questionTypeKey"])
        : undefined;

    const actions: WorkspaceAction[] = actionDefinitions.map((definition) => {
      const effectiveDefinition = {
        ...definition,
        questionTypeKey:
          selectedQuestionTypeKey && definition.questionTypeKey
            ? selectedQuestionTypeKey
            : definition.questionTypeKey,
        styleKey:
          selectedStyleKey && definition.styleKey ? selectedStyleKey : definition.styleKey,
      };
      const blocks: WorkspaceBlock[] = [
        ...effectiveDefinition.basePromptKeys
          .map((key) => blockFromConfig(activeConfig(configs, key)))
          .filter((block): block is WorkspaceBlock => Boolean(block)),
        blockFromComponent(
          component(components, "mode", effectiveDefinition.modeKey),
          "Mode Instructions",
        ),
        blockFromComponent(
          component(components, "question_type", effectiveDefinition.questionTypeKey),
          "Question Focus",
        ),
        blockFromComponent(
          component(components, "style", effectiveDefinition.styleKey),
          "Style",
        ),
        runtimeContextBlock(effectiveDefinition),
        ...generatedBlocks(effectiveDefinition),
      ].filter((block): block is WorkspaceBlock => Boolean(block));

      blocks.push({
        body: finalPreview(blocks),
        collapsed: true,
        readOnly: true,
        title: "Final Preview",
      });

      return {
        blocks,
        description: definition.description,
        key: definition.key,
        modeKey: definition.modeKey,
        testTunnel: definition.testTunnel,
        title: definition.title,
      };
    });

    return NextResponse.json({ actions });
  } catch (error) {
    console.error("Prompt workspace preview failed.", error);
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : "Prompt workspace could not be loaded.",
        error: "Prompt workspace could not be loaded.",
      },
      { status: 503 },
    );
  }
}
