export type StudyGenerationPacketAnchor = {
  page: number;
  x1?: number;
  x2?: number;
  y1?: number;
  y2?: number;
};

export type StudyGenerationPacketChunk = {
  chunkId: string;
  pageAnchors: StudyGenerationPacketAnchor[];
  relatedVisualIds: string[];
  snippet: string;
  tags: string[];
};

export type StudyGenerationPacketContract = {
  chunks: StudyGenerationPacketChunk[];
  deckRequest: {
    cardTarget: number;
    subject?: string;
    title: string;
  };
  instructions?: string;
  outputRestrictions: {
    canMarkOfficial: false;
    canMarkVerified: false;
    canPublish: false;
    canWriteStudyRuntime: false;
  };
  packetVersion: "quesiq.studyGenerationPacket.v1";
  sourcePack: {
    pageRange: {
      endPage: number;
      startPage: number;
    };
    sourcePackId: string;
    title: string;
  };
  targetContract: "study.sourcePackDeckDraft.v1";
};

type ParseResult =
  | { ok: true; packet: StudyGenerationPacketContract }
  | { errors: string[]; ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseStringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array of strings.`);
    return [];
  }
  const parsed = value.map((item) => asString(item)).filter(Boolean);
  if (parsed.length !== value.length) {
    errors.push(`${path} must contain only non-empty strings.`);
  }
  return Array.from(new Set(parsed));
}

function parseAnchor(value: unknown, path: string, errors: string[]): StudyGenerationPacketAnchor | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const page = typeof value.page === "number" ? value.page : Number.NaN;
  if (!Number.isInteger(page) || page < 1) {
    errors.push(`${path}.page must be an integer >= 1.`);
    return null;
  }
  const parsed: StudyGenerationPacketAnchor = { page };
  const coords = ["x1", "x2", "y1", "y2"] as const;
  for (const coord of coords) {
    const coordValue = value[coord];
    if (coordValue === undefined) continue;
    if (typeof coordValue !== "number" || Number.isNaN(coordValue)) {
      errors.push(`${path}.${coord} must be a number when provided.`);
      continue;
    }
    parsed[coord] = coordValue;
  }
  return parsed;
}

function parseChunk(value: unknown, path: string, sourcePackRange: { endPage: number; startPage: number }, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const chunkId = asString(value.chunkId);
  const snippet = asString(value.snippet);
  const tags = parseStringArray(value.tags, `${path}.tags`, errors);
  const relatedVisualIds = parseStringArray(value.relatedVisualIds, `${path}.relatedVisualIds`, errors);
  const rawAnchors = Array.isArray(value.pageAnchors) ? value.pageAnchors : [];
  if (!Array.isArray(value.pageAnchors)) {
    errors.push(`${path}.pageAnchors must be an array.`);
  }
  const pageAnchors = rawAnchors
    .map((anchor, index) => parseAnchor(anchor, `${path}.pageAnchors[${index}]`, errors))
    .filter((anchor): anchor is StudyGenerationPacketAnchor => Boolean(anchor));

  if (!chunkId) errors.push(`${path}.chunkId is required.`);
  if (!snippet) errors.push(`${path}.snippet is required.`);
  if (pageAnchors.length === 0) errors.push(`${path}.pageAnchors must include at least one anchor.`);

  if (
    pageAnchors.some(
      (anchor) => anchor.page < sourcePackRange.startPage || anchor.page > sourcePackRange.endPage,
    )
  ) {
    errors.push(`${path}.pageAnchors must stay within sourcePack.pageRange.`);
  }

  if (!chunkId || !snippet || pageAnchors.length === 0) return null;
  return {
    chunkId,
    pageAnchors,
    relatedVisualIds,
    snippet,
    tags,
  } satisfies StudyGenerationPacketChunk;
}

export function parseStudyGenerationPacketContract(value: unknown): ParseResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { errors: ["Generation packet payload must be an object."], ok: false };
  }

  if (value.packetVersion !== "quesiq.studyGenerationPacket.v1") {
    errors.push("packetVersion must be quesiq.studyGenerationPacket.v1.");
  }
  if (value.targetContract !== "study.sourcePackDeckDraft.v1") {
    errors.push("targetContract must be study.sourcePackDeckDraft.v1.");
  }
  if (!isRecord(value.sourcePack)) {
    errors.push("sourcePack must be an object.");
    return { errors, ok: false };
  }

  const sourcePackId = asString(value.sourcePack.sourcePackId);
  const sourcePackTitle = asString(value.sourcePack.title);
  const sourcePackRangeRaw = isRecord(value.sourcePack.pageRange) ? value.sourcePack.pageRange : null;
  if (!sourcePackRangeRaw) {
    errors.push("sourcePack.pageRange must be an object.");
    return { errors, ok: false };
  }
  const startPage = typeof sourcePackRangeRaw.startPage === "number" ? sourcePackRangeRaw.startPage : Number.NaN;
  const endPage = typeof sourcePackRangeRaw.endPage === "number" ? sourcePackRangeRaw.endPage : Number.NaN;
  if (!Number.isInteger(startPage) || startPage < 1) errors.push("sourcePack.pageRange.startPage must be an integer >= 1.");
  if (!Number.isInteger(endPage) || endPage < 1) errors.push("sourcePack.pageRange.endPage must be an integer >= 1.");
  if (Number.isInteger(startPage) && Number.isInteger(endPage) && endPage < startPage) {
    errors.push("sourcePack.pageRange.endPage must be >= startPage.");
  }
  if (!sourcePackId) errors.push("sourcePack.sourcePackId is required.");
  if (!sourcePackTitle) errors.push("sourcePack.title is required.");

  if (!isRecord(value.deckRequest)) {
    errors.push("deckRequest must be an object.");
    return { errors, ok: false };
  }
  const deckTitle = asString(value.deckRequest.title);
  const deckSubject = asString(value.deckRequest.subject) || undefined;
  const cardTarget = typeof value.deckRequest.cardTarget === "number" ? value.deckRequest.cardTarget : Number.NaN;
  if (!deckTitle) errors.push("deckRequest.title is required.");
  if (!Number.isInteger(cardTarget) || cardTarget < 1 || cardTarget > 200) {
    errors.push("deckRequest.cardTarget must be an integer between 1 and 200.");
  }

  if (!isRecord(value.outputRestrictions)) {
    errors.push("outputRestrictions must be an object.");
    return { errors, ok: false };
  }
  const outputRestrictions = value.outputRestrictions;
  if (outputRestrictions.canPublish !== false) errors.push("outputRestrictions.canPublish must be false.");
  if (outputRestrictions.canMarkOfficial !== false) errors.push("outputRestrictions.canMarkOfficial must be false.");
  if (outputRestrictions.canMarkVerified !== false) errors.push("outputRestrictions.canMarkVerified must be false.");
  if (outputRestrictions.canWriteStudyRuntime !== false) {
    errors.push("outputRestrictions.canWriteStudyRuntime must be false.");
  }

  const rawChunks = Array.isArray(value.chunks) ? value.chunks : [];
  if (!Array.isArray(value.chunks)) {
    errors.push("chunks must be an array.");
  }
  const safeStart = Number.isInteger(startPage) ? startPage : 1;
  const safeEnd = Number.isInteger(endPage) ? endPage : safeStart;
  const chunks = rawChunks
    .map((chunk, index) => parseChunk(chunk, `chunks[${index}]`, { endPage: safeEnd, startPage: safeStart }, errors))
    .filter((chunk): chunk is StudyGenerationPacketChunk => Boolean(chunk));
  if (chunks.length === 0) errors.push("chunks must include at least one valid chunk.");

  if (
    errors.length > 0 ||
    !sourcePackId ||
    !sourcePackTitle ||
    !deckTitle ||
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    !Number.isInteger(cardTarget) ||
    chunks.length === 0
  ) {
    return { errors, ok: false };
  }

  return {
    ok: true,
    packet: {
      chunks,
      deckRequest: {
        cardTarget,
        subject: deckSubject,
        title: deckTitle,
      },
      instructions: asString(value.instructions) || undefined,
      outputRestrictions: {
        canMarkOfficial: false,
        canMarkVerified: false,
        canPublish: false,
        canWriteStudyRuntime: false,
      },
      packetVersion: "quesiq.studyGenerationPacket.v1",
      sourcePack: {
        pageRange: {
          endPage,
          startPage,
        },
        sourcePackId,
        title: sourcePackTitle,
      },
      targetContract: "study.sourcePackDeckDraft.v1",
    },
  };
}

export function getStudyGenerationPacketReviewSections(packet: StudyGenerationPacketContract) {
  const uniqueVisualIds = new Set(packet.chunks.flatMap((chunk) => chunk.relatedVisualIds)).size;
  return [
    {
      items: [
        `Source Pack: ${packet.sourcePack.sourcePackId}`,
        `Title: ${packet.sourcePack.title}`,
        `Page range: ${packet.sourcePack.pageRange.startPage}-${packet.sourcePack.pageRange.endPage}`,
        `Chunks: ${packet.chunks.length}`,
      ],
      title: "Source Pack",
    },
    {
      items: [
        `Deck title: ${packet.deckRequest.title}`,
        `Subject: ${packet.deckRequest.subject || "None"}`,
        `Card target: ${packet.deckRequest.cardTarget}`,
        `Target contract: ${packet.targetContract}`,
      ],
      title: "Deck Request",
    },
    {
      items: [
        `Publish disabled: ${packet.outputRestrictions.canPublish ? "no" : "yes"}`,
        `Official disabled: ${packet.outputRestrictions.canMarkOfficial ? "no" : "yes"}`,
        `Verified disabled: ${packet.outputRestrictions.canMarkVerified ? "no" : "yes"}`,
        `Runtime write disabled: ${packet.outputRestrictions.canWriteStudyRuntime ? "no" : "yes"}`,
        `Related visuals: ${uniqueVisualIds}`,
      ],
      title: "Restrictions",
    },
  ];
}

export const STUDY_GENERATION_PACKET_SAMPLE: StudyGenerationPacketContract = {
  chunks: [
    {
      chunkId: "chunk-001",
      pageAnchors: [{ page: 12, x1: 0.1, x2: 0.8, y1: 0.2, y2: 0.5 }],
      relatedVisualIds: ["figure-12-a"],
      snippet: "Stabilize pitch and trim before introducing larger control input.",
      tags: ["fundamentals", "flight-controls"],
    },
  ],
  deckRequest: {
    cardTarget: 12,
    subject: "Flight Fundamentals",
    title: "Stability And Control Draft",
  },
  instructions: "Focus on source-grounded prompts and concise answers.",
  outputRestrictions: {
    canMarkOfficial: false,
    canMarkVerified: false,
    canPublish: false,
    canWriteStudyRuntime: false,
  },
  packetVersion: "quesiq.studyGenerationPacket.v1",
  sourcePack: {
    pageRange: {
      endPage: 20,
      startPage: 10,
    },
    sourcePackId: "sample-source-pack",
    title: "Sample Source Pack",
  },
  targetContract: "study.sourcePackDeckDraft.v1",
};
