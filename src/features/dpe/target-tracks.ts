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
    certificate: "Instrument Airplane",
    code: "IRA",
    contentReady: false,
    id: "instrument_airplane",
    title: "Instrument Airplane",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "Commercial Pilot",
    code: "CAX-ASEL",
    contentReady: false,
    id: "commercial_airplane_land",
    title: "Commercial Airplane Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "CFI Airplane",
    code: "CFI-A",
    contentReady: false,
    id: "cfi_airplane",
    title: "CFI Airplane",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Single-Engine Land",
    certificate: "CFII Airplane",
    code: "CFII-A",
    contentReady: false,
    id: "cfii_airplane",
    title: "CFII Airplane",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Multi-Engine Land",
    certificate: "Multi-Engine Land",
    code: "MEL",
    contentReady: false,
    id: "multi_engine_land",
    title: "Multi-Engine Land",
  },
  {
    aircraftCategory: "Airplane",
    aircraftClass: "Multi-Engine Land",
    certificate: "MEI Airplane",
    code: "MEI-A",
    contentReady: false,
    id: "mei_airplane",
    title: "MEI Airplane",
  },
];

export const defaultDpeTargetTrackId = "private_pilot_asel";

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

  return (
    dpeTargetTracks.find(
      (track) =>
        track.certificate === (input.certificate ?? "").trim() &&
        track.aircraftCategory === (input.aircraftCategory ?? "").trim() &&
        track.aircraftClass === (input.aircraftClass ?? "").trim(),
    ) ?? dpeTargetTracks[0]
  );
}
