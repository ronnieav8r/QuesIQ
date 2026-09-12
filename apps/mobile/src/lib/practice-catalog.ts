import type { InterviewStyleKey, MobileBootstrap, PracticeModeKey, QuestionTypeKey } from "@quesiq/interview-contracts";

const supportedModes = new Set<PracticeModeKey>(["first_impression", "coaching", "rapid_fire", "mock_interview"]);

export type AvailablePracticeMode = Extract<MobileBootstrap["catalog"]["practiceModes"][number], { key: string }> & { key: PracticeModeKey };

export function availablePracticeModes(catalog: MobileBootstrap["catalog"]): AvailablePracticeMode[] {
  return catalog.practiceModes.filter((mode): mode is AvailablePracticeMode => supportedModes.has(mode.key as PracticeModeKey));
}

export function resolvePracticeMode(current: PracticeModeKey | undefined, requested: string | undefined, modes: AvailablePracticeMode[]): PracticeModeKey | undefined {
  if (current && modes.some((mode) => mode.key === current)) return current;
  if (requested && modes.some((mode) => mode.key === requested)) return requested as PracticeModeKey;
  return modes.find((mode) => mode.key === "coaching")?.key ?? modes[0]?.key;
}

export function resolveCatalogChoice<T extends string>(current: T | undefined, choices: readonly { key: T }[]): T | undefined {
  return current && choices.some((choice) => choice.key === current) ? current : choices[0]?.key;
}

export function preferredTargetId(bootstrap: MobileBootstrap): string | undefined {
  const profileTargetId = bootstrap.profile?.jobTargetId;
  return bootstrap.jobTargets.some((target) => target.id === profileTargetId) ? profileTargetId : undefined;
}

export function canLaunchPractice(mode: AvailablePracticeMode | undefined, style: InterviewStyleKey | undefined, questionType: QuestionTypeKey | undefined): boolean {
  return Boolean(mode && style && (!mode.questionTypeRequired || questionType));
}
