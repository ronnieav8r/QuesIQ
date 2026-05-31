export type DpeTargetTrackKey =
  | "cfi_airplane_land"
  | "cfii_airplane_land"
  | "commercial_airplane_land"
  | "instrument_airplane_land"
  | "mei_airplane_land"
  | "multi_airplane_land";

export type DpeTargetTrack = {
  defaultCertificate: {
    code: string;
    id: string;
    title: string;
  };
  description: string;
  key: DpeTargetTrackKey;
  label: string;
  matcher: {
    codeIncludes: string[];
    idIncludes: string[];
    titleIncludes: string[];
  };
};

export const dpeTargetTracks: DpeTargetTrack[] = [
  {
    defaultCertificate: {
      code: "INST_ASEL",
      id: "instrument-airplane-land",
      title: "Instrument Rating Airplane",
    },
    description: "Instrument rating oral readiness.",
    key: "instrument_airplane_land",
    label: "Instrument (Airplane Land)",
    matcher: {
      codeIncludes: ["instrument", "ifr", "inst"],
      idIncludes: ["instrument", "ifr", "inst"],
      titleIncludes: ["instrument rating", "instrument airplane", "instrument"],
    },
  },
  {
    defaultCertificate: {
      code: "COMM_ASEL",
      id: "commercial-airplane-land",
      title: "Commercial Pilot Airplane",
    },
    description: "Commercial oral readiness.",
    key: "commercial_airplane_land",
    label: "Commercial (Airplane Land)",
    matcher: {
      codeIncludes: ["commercial", "comm", "cpl"],
      idIncludes: ["commercial", "comm", "cpl"],
      titleIncludes: ["commercial pilot", "commercial airplane", "commercial"],
    },
  },
  {
    defaultCertificate: {
      code: "CFII_ASEL",
      id: "cfii-airplane-land",
      title: "Flight Instructor Instrument Airplane",
    },
    description: "CFII oral readiness.",
    key: "cfii_airplane_land",
    label: "CFII (Airplane Land)",
    matcher: {
      codeIncludes: ["cfii", "instrument instructor"],
      idIncludes: ["cfii", "instrument-instructor"],
      titleIncludes: ["flight instructor instrument", "instrument instructor", "cfii"],
    },
  },
  {
    defaultCertificate: {
      code: "CFI_ASEL",
      id: "cfi-airplane-land",
      title: "Flight Instructor Airplane",
    },
    description: "CFI oral readiness.",
    key: "cfi_airplane_land",
    label: "CFI (Airplane Land)",
    matcher: {
      codeIncludes: ["cfi"],
      idIncludes: ["cfi", "flight-instructor"],
      titleIncludes: ["certified flight instructor", "flight instructor"],
    },
  },
  {
    defaultCertificate: {
      code: "MEI_AMEL",
      id: "mei-airplane-land",
      title: "Multi-Engine Instructor Airplane",
    },
    description: "MEI oral readiness.",
    key: "mei_airplane_land",
    label: "MEI (Airplane Land)",
    matcher: {
      codeIncludes: ["mei", "multi-engine instructor", "multi instructor"],
      idIncludes: ["mei", "multi-engine-instructor", "multi-instructor"],
      titleIncludes: ["multi-engine instructor", "multi engine instructor", "mei"],
    },
  },
  {
    defaultCertificate: {
      code: "COMM_AMEL",
      id: "multi-engine-airplane",
      title: "Multi-Engine Airplane",
    },
    description: "Multi-engine oral readiness.",
    key: "multi_airplane_land",
    label: "Multi (Airplane Land)",
    matcher: {
      codeIncludes: ["multi", "amel", "multi-engine"],
      idIncludes: ["multi", "amel", "multi-engine"],
      titleIncludes: ["multi-engine", "multi engine", "airplane multiengine"],
    },
  },
];

export function parseDpeTargetTrackKey(value: unknown) {
  return typeof value === "string" &&
    dpeTargetTracks.some((track) => track.key === value)
    ? (value as DpeTargetTrackKey)
    : undefined;
}

export function findDpeTargetTrack(key?: DpeTargetTrackKey) {
  return dpeTargetTracks.find((track) => track.key === key);
}

function includesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function inferDpeTargetTrackKeyFromCertificate(input: {
  code?: string | null;
  id?: string | null;
  title?: string | null;
}) {
  const code = normalize(input.code);
  const id = normalize(input.id);
  const title = normalize(input.title);

  const normalizedCode = code.replaceAll("-", "_");
  const normalizedId = id.replaceAll("-", "_");

  for (const track of dpeTargetTracks) {
    if (
      includesAny(normalizedCode, track.matcher.codeIncludes) ||
      includesAny(normalizedId, track.matcher.idIncludes) ||
      includesAny(title, track.matcher.titleIncludes)
    ) {
      return track.key;
    }
  }

  return undefined;
}
