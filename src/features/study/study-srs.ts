export type StudyVerdict = "again" | "almost" | "correct" | "easy" | "good" | "hard" | "missed";

const quality: Record<StudyVerdict, number> = {
  again: 1,
  almost: 3,
  correct: 5,
  easy: 5,
  good: 4,
  hard: 3,
  missed: 1,
};

type StudyCardSrs = {
  dueAt: Date | null;
  easeFactor: number;
  interval: number;
  lapses: number;
};

export function computeNextStudyReview(card: StudyCardSrs, verdict: StudyVerdict) {
  const score = quality[verdict];
  let { easeFactor, interval, lapses } = card;

  if (score < 3) {
    interval = 1;
    lapses += 1;
  } else if (card.dueAt === null) {
    interval = 1;
  } else if (interval <= 1) {
    interval = 6;
  } else {
    interval = Math.round(interval * easeFactor);
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02),
  );

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + interval);

  return { dueAt, easeFactor, interval, lapses };
}
