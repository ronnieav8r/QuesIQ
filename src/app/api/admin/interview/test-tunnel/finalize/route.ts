import { NextResponse } from "next/server";

import type { VoiceSessionArtifactDraft } from "@/product/interview-types";
import { parseVoiceSessionArtifact } from "@/product/voice-session-artifact";
import { requireAdminSession } from "@/server/admin";
import { getOpenAiInterviewTestTunnelApiKey } from "@/server/openai/keys";
import { createSessionEvaluation } from "@/server/sessions/create-session-evaluation";
import { saveSessionArtifact } from "@/server/sessions/save-session-artifact";

export const runtime = "nodejs";

type RequestBody = {
  artifact?: unknown;
  createEvaluation?: boolean;
  sessionId?: string;
};

function withTestTunnelMetadata(artifact: VoiceSessionArtifactDraft): VoiceSessionArtifactDraft {
  return {
    ...artifact,
    metadata: {
      ...artifact.metadata,
      inputModality: "text_simulated_voice",
      testTunnel: true,
      testTunnelSource: "admin_text_input",
    },
  };
}

export async function POST(request: Request) {
  const appSession = await requireAdminSession();

  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Prompt Test Tunnel needs a configured database." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as RequestBody;
  const sessionId = body.sessionId?.trim();
  const parsedArtifact = parseVoiceSessionArtifact(body.artifact);

  if (!sessionId || !parsedArtifact) {
    return NextResponse.json({ error: "Finalize payload is invalid." }, { status: 400 });
  }

  try {
    const session = await saveSessionArtifact(
      sessionId,
      appSession.user.id,
      withTestTunnelMetadata(parsedArtifact),
    );

    if (!session) {
      return NextResponse.json({ error: "Session was not found." }, { status: 404 });
    }

    if (body.createEvaluation === true) {
      const apiKey = getOpenAiInterviewTestTunnelApiKey();

      if (!apiKey) {
        return NextResponse.json(
          {
            error:
              "Test session was saved, but the Interview test tunnel OpenAI key is not configured for review.",
            session,
          },
          { status: 503 },
        );
      }

      const evaluation = await createSessionEvaluation(sessionId, appSession.user.id, {
        apiKeyOverride: apiKey,
      });

      return NextResponse.json({ evaluation, session });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Prompt Test Tunnel finalize failed.", error);
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Test session could not be finalized.",
        error: "Prompt Test Tunnel session could not be finalized.",
      },
      { status: 503 },
    );
  }
}
