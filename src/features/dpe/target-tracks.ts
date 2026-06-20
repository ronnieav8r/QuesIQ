export type DpeTargetTrack = {
  aircraftCategory: "Airplane";
  aircraftClass: "Multi-Engine Land" | "Single-Engine Land";
  certificate: string;
  code: string;
  contentReady: boolean;
  id: string;
  title: string;
};

export const dpeTargetTracks: DpeTargetTrack[] = [
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "Private Pilot",
    code: "PPL-ASEL",
    contentReady: true,
    id: "private_pilot_asel",
    title: "Private Pilot ASEL",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "Instrument Airplane Land",
    code: "IRA",
    contentReady: true,
    id: "instrument_airplane",
    title: "Instrument Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "Commercial Airplane Land",
    code: "CAX-ASEL",
    contentReady: false,
    id: "commercial_airplane_land",
    title: "Commercial Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "CFI Airplane Land",
    code: "CFI-A",
    contentReady: false,
    id: "cfi_airplane",
    title: "CFI Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "CFII Airplane Land",
    code: "CFII-A",
    contentReady: false,
    id: "cfii_airplane",
    title: "CFII Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Multi-Engine Land",
    certificate: "Multi-Engine Airplane Land",
    code: "MEL",
    contentReady: false,
    id: "multi_engine_land",
    title: "Multi-Engine Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Multi-Engine Land",
    certificate: "MEI Airplane Land",
    code: "MEI-A",
    contentReady: false,
    id: "mei_airplane",
    title: "MEI Airplane Land",
  },
];

export const defaultDpeTargetTrackId = "private_pilot_asel";

const certificateAliases: Record<string, string> = {
  "cfi airplane": "CFI Airplane Land",
  "cfii airplane": "CFII Airplane Land",
  "commercial pilot": "Commercial Airplane Land",
  "instrument airplane": "Instrument Airplane Land",
  "mei airplane": "MEI Airplane Land",
  "multi-engine land": "Multi-Engine Airplane Land",
  "multi-engine airplane land": "Multi-Engine Airplane Land",
};

export function getDpeTargetTrackById(trackId: string | null | undefined) {
  if (!trackId) return undefined;
  return dpeTargetTracks.find((track) => track.id === trackId);
}

export function resolveDpeTargetTrack(input: {
  aircraftCategory?: string | null;
  aircraftClass?: string | null;
  certificate?: string | null;
  targetTrackId?: string | null;
}) {
  const byId = getDpeTargetTrackById(input.targetTrackId);
  if (byId) return byId;
  const normalizedCertificate =
    certificateAliases[(input.certificate ?? "").trim().toLowerCase()] ??
    (input.certificate ?? "").trim();

  return (
    dpeTargetTracks.find(
      (track) =>
        track.certificate === normalizedCertificate &&
        track.aircraftCategory === (input.aircraftCategory ?? "").trim() &&
        track.aircraftClass === (input.aircraftClass ?? "").trim(),
    ) ?? dpeTargetTracks[0]
  );
}
