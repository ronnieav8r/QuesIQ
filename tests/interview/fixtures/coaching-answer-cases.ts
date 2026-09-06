/** Synthetic inputs for deterministic coverage and later opt-in, human-rated model runs. */
export const coachingAnswerCases = [
  { name: "strong", answer: "I divided the remaining checks between two qualified teammates, confirmed completion, and we departed on time.", review: "Acknowledge the concrete contribution without inventing metrics." },
  { name: "vague", answer: "We worked together and it went well.", review: "Ask for one specific personal contribution, not several questions." },
  { name: "off_topic", answer: "I would rather talk about my favorite movie.", review: "Redirect respectfully to the current interview question." },
  { name: "lengthy", answer: "The situation involved several teams and a deadline. ".repeat(35) + "I assigned owners to the remaining tasks and confirmed completion.", review: "Select one useful improvement without lengthy multi-point feedback." },
  { name: "revised", answer: "More specifically, I assigned one owner to each task and verified that everyone understood the deadline. We completed the handoff that afternoon.", review: "Respond to the revised answer, not the previous attempt." },
] as const;
