import { NextResponse } from "next/server";

import { dpeTargetTracks } from "@/features/dpe/target-tracks";
import { countReadyDpeConceptVariants } from "@/server/dpe/concept-content";
import { listDpeContentSummary } from "@/server/dpe/dpe-data";
import { getOpenAiApiKey, getOpenAiRealtimeApiKey } from "@/server/openai/keys";

export const runtime = "nodejs";

function buildDpeRuntimeReadiness() {
  return {
    reviewAiConfigured: Boolean(getOpenAiApiKey("dpe")),
    realtimeVoiceConfigured: Boolean(getOpenAiRealtimeApiKey("dpe")),
  };
}

function buildTargetTrackStatus() {
  return dpeTargetTracks.map((track) => ({
    aircraftCategory: track.aircraftCategory,
    aircraftClass: track.aircraftClass,
    code: track.code,
    contentReady: track.contentReady,
    title: track.title,
  }));
}

function buildTargetTrackSummary() {
  const ready = dpeTargetTracks.filter((track) => track.contentReady).length;
  return {
    contentReady: ready,
    scaffolded: dpeTargetTracks.length - ready,
    total: dpeTargetTracks.length,
  };
}

export async function GET() {
  const runtimeReadiness = buildDpeRuntimeReadiness();
  const targetTrackSummary = buildTargetTrackSummary();

  try {
    const [summary, conceptVariantCount] = await Promise.all([
      listDpeContentSummary(),
      countReadyDpeConceptVariants(),
    ]);
    const questionCount = summary.certificateTypes.reduce(
      (total, certificateType) => total + certificateType.questions.length,
      0,
    );

    return NextResponse.json({
      conceptVariantCount,
      contentTablesReachable: summary.available,
      questionCount,
      reviewAiConfigured: runtimeReadiness.reviewAiConfigured,
      realtimeVoiceConfigured: runtimeReadiness.realtimeVoiceConfigured,
      status: summary.available ? "ok" : "degraded",
      targetTrackSummary,
      targetTracks: buildTargetTrackStatus(),
    });
  } catch {
    return NextResponse.json({
      conceptVariantCount: 0,
      contentTablesReachable: false,
      questionCount: 0,
      reviewAiConfigured: runtimeReadiness.reviewAiConfigured,
      realtimeVoiceConfigured: runtimeReadiness.realtimeVoiceConfigured,
      status: "degraded",
      targetTrackSummary,
      targetTracks: buildTargetTrackStatus(),
    });
  }
}
