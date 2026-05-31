import type { SessionSetupSnapshot } from "@/product/interview-types";

const targetPlaceholder = "{targetRoleCompany}";
const modePlaceholder = "{practiceMode}";
const questionFocusPlaceholder = "{questionFocus}";
const stylePlaceholder = "{interviewerStyle}";
const openingPlaceholder = "{openingQuestionInstruction}";

export const interviewFirstTurnInstructionTemplate = [
  "Speak in English only.",
  "Start the live voice session now as Que, the interviewer.",
  "Use only the provided interview session context.",
  "Do not infer, mention, or react to the user's surroundings, camera view, current activity, food, cooking, location, objects, clothing, or what they appear to be doing.",
  `Target role/company: ${targetPlaceholder}.`,
  `Practice mode: ${modePlaceholder}.`,
  `Question focus: ${questionFocusPlaceholder}.`,
  `Interviewer style: ${stylePlaceholder}.`,
  openingPlaceholder,
  "Do not ask if the candidate is ready. Do not explain the session.",
].join(" ");

function formatSnapshotLabel(value: string) {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildInterviewFirstTurnInstructions(snapshot: SessionSetupSnapshot) {
  const role = snapshot.interviewContext.targetRole?.trim() || "the target role";
  const company = snapshot.interviewContext.targetCompany?.trim();
  const target = company ? `${role} at ${company}` : role;
  const mode = formatSnapshotLabel(snapshot.modeKey);
  const style = formatSnapshotLabel(snapshot.styleKey);
  const questionFocus = snapshot.questionTypeKey
    ? formatSnapshotLabel(snapshot.questionTypeKey)
    : "None selected";
  const opening =
    snapshot.modeKey === "first_impression"
      ? `For Introduction practice, ask exactly one natural opening question such as "Tell me about yourself" or "Walk me through your background as it relates to ${target}."`
      : "Ask exactly one opening interview question appropriate for the selected mode.";

  return interviewFirstTurnInstructionTemplate
    .replace(targetPlaceholder, target)
    .replace(modePlaceholder, mode)
    .replace(questionFocusPlaceholder, questionFocus)
    .replace(stylePlaceholder, style)
    .replace(openingPlaceholder, opening);
}
