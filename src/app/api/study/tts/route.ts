import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { completeAiRun, startAiRun } from "@/server/ai-runs/ai-runs";
import { getDb } from "@/server/db/client";
import { studyCards } from "@/server/db/schema";
import { getOpenAiApiKey } from "@/server/openai/keys";
import { isStudyStorageConfigured, uploadStudyAudio } from "@/server/study/storage";

export const runtime = "nodejs";

type StudyAudioType = "question" | "quiz_mc" | "tf_false" | "tf_true";

const AUDIO_CONFIG: Record<
  StudyAudioType,
  {
    fileKey: (cardId: string) => string;
    getUrl: (card: typeof studyCards.$inferSelect) => string | null;
    update: (url: string, foilCardId?: string) => Partial<typeof studyCards.$inferInsert>;
  }
> = {
  question: {
    fileKey: (cardId) => `study/tts/${cardId}.mp3`,
    getUrl: (card) => card.questionAudioUrl,
    update: (url) => ({ questionAudioUrl: url }),
  },
  quiz_mc: {
    fileKey: (cardId) => `study/tts/${cardId}_quiz.mp3`,
    getUrl: (card) => card.quizMcAudioUrl,
    update: (url) => ({ quizMcAudioUrl: url }),
  },
  tf_false: {
    fileKey: (cardId) => `study/tts/${cardId}_tf_false.mp3`,
    getUrl: (card) => card.tfFalseAudioUrl,
    update: (url, foilCardId) => ({
      tfFalseAudioUrl: url,
      ...(foilCardId ? { tfFoilCardId: foilCardId } : {}),
    }),
  },
  tf_true: {
    fileKey: (cardId) => `study/tts/${cardId}_tf_true.mp3`,
    getUrl: (card) => card.tfTrueAudioUrl,
    update: (url) => ({ tfTrueAudioUrl: url }),
  },
};

export async function POST(request: NextRequest) {
  const appSession = await auth();
  if (!appSession?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    audioType?: StudyAudioType;
    cardId?: string;
    foilCardId?: string;
    text?: string;
  };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  const apiKey = getOpenAiApiKey("study");
  if (!apiKey) {
    return NextResponse.json({ error: "Study OpenAI key is not configured." }, { status: 500 });
  }

  const audioType = body.audioType && body.audioType in AUDIO_CONFIG ? body.audioType : "question";
  const audioConfig = AUDIO_CONFIG[audioType];
  const db = getDb();

  if (body.cardId) {
    const [card] = await db.select().from(studyCards).where(eq(studyCards.id, body.cardId)).limit(1);
    const cachedUrl = card ? audioConfig.getUrl(card) : null;

    if (cachedUrl) {
      try {
        const cached = await fetch(cachedUrl);
        if (cached.ok) {
          const buffer = Buffer.from(await cached.arrayBuffer());
          return new NextResponse(buffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "X-Audio-Cache": "hit",
            },
          });
        }
      } catch {
        // Cache read failures fall through to fresh generation.
      }
    }
  }

  const run = await startAiRun({
    model: "tts-1",
    rawJson: { audioType, cardId: body.cardId, textLength: text.length },
    runType: "study_tts",
    userId: appSession.user.id,
  });

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      body: JSON.stringify({
        input: text.slice(0, 1000),
        model: "tts-1",
        response_format: "mp3",
        voice: "alloy",
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const detail = await response.text();
      await completeAiRun(run.id, {
        errorMessage: `Study TTS failed: ${detail.slice(0, 300)}`,
        rawJson: { status: response.status },
        status: "failed",
      });
      return NextResponse.json({ error: "TTS request failed." }, { status: 502 });
    }

    const providerRequestId = response.headers.get("x-request-id") ?? undefined;
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    let cachedUrl: string | undefined;

    if (body.cardId && isStudyStorageConfigured()) {
      try {
        cachedUrl = await uploadStudyAudio(audioConfig.fileKey(body.cardId), audioBuffer);
        await db
          .update(studyCards)
          .set({
            ...audioConfig.update(cachedUrl, body.foilCardId),
            updatedAt: new Date(),
          })
          .where(eq(studyCards.id, body.cardId));
      } catch {
        cachedUrl = undefined;
      }
    }

    await completeAiRun(run.id, {
      providerRequestId,
      rawJson: { bytes: audioBuffer.byteLength, cached: Boolean(cachedUrl) },
      status: "succeeded",
    });

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Cache": cachedUrl ? "stored" : "miss",
      },
    });
  } catch (error) {
    await completeAiRun(run.id, {
      errorMessage: error instanceof Error ? error.message : "Study TTS failed.",
      status: "failed",
    });
    return NextResponse.json({ error: "Study TTS failed." }, { status: 503 });
  }
}
