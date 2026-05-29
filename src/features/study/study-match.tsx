"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { StudyVerdict } from "@/features/study/study-srs";

type StudyMatchCard = {
  answer: string;
  id: string;
  question: string;
};

type Tile = {
  cardId: string;
  text: string;
  tileId: string;
  type: "answer" | "question";
};

type TileState = "idle" | "matched" | "selected" | "wrong";

type StudyMatchProps = {
  cards: StudyMatchCard[];
  deckId: string;
  filter?: string;
};

const ROUND_SIZE = 6;

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function verdictFromMismatchCount(mismatches: number): StudyVerdict {
  if (mismatches === 0) {
    return "easy";
  }
  if (mismatches === 1) {
    return "good";
  }
  if (mismatches <= 3) {
    return "hard";
  }
  return "again";
}

export function StudyMatch({ cards, deckId, filter }: StudyMatchProps) {
  const [orderedCards] = useState(() => shuffle(cards));
  const initialRoundCards = orderedCards.slice(0, ROUND_SIZE);
  const initialQuestionTiles = shuffle(
    initialRoundCards.map((card) => ({
      cardId: card.id,
      text: card.question,
      tileId: `q-${card.id}`,
      type: "question" as const,
    })),
  );
  const initialAnswerTiles = shuffle(
    initialRoundCards.map((card) => ({
      cardId: card.id,
      text: card.answer,
      tileId: `a-${card.id}`,
      type: "answer" as const,
    })),
  );
  const initialTiles = [...initialQuestionTiles, ...initialAnswerTiles];
  const initialTileMap = new Map(initialTiles.map((tile) => [tile.tileId, tile]));
  const initialTileStates = initialTiles.reduce<Record<string, TileState>>((acc, tile) => {
    acc[tile.tileId] = "idle";
    return acc;
  }, {});
  const [roundIndex, setRoundIndex] = useState(0);
  const [questionTiles, setQuestionTiles] = useState<Tile[]>(initialQuestionTiles);
  const [answerTiles, setAnswerTiles] = useState<Tile[]>(initialAnswerTiles);
  const [tileMap, setTileMap] = useState<Map<string, Tile>>(initialTileMap);
  const [tileStates, setTileStates] = useState<Record<string, TileState>>(initialTileStates);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [matchedCount, setMatchedCount] = useState(0);
  const [phase, setPhase] = useState<"playing" | "summary">("playing");
  const [allResults, setAllResults] = useState<Array<{ cardId: string; mismatches: number }>>([]);
  const lockedRef = useRef(false);
  const mismatchRef = useRef<Record<string, number>>({});
  const sessionIdRef = useRef<string | null>(null);

  const totalRounds = Math.ceil(orderedCards.length / ROUND_SIZE);

  const getRoundCards = useCallback(
    (index: number) => orderedCards.slice(index * ROUND_SIZE, (index + 1) * ROUND_SIZE),
    [orderedCards],
  );

  const buildRound = useCallback(
    (index: number) => {
      const roundCards = getRoundCards(index);
      const nextQuestions = shuffle(
        roundCards.map((card) => ({
          cardId: card.id,
          text: card.question,
          tileId: `q-${card.id}`,
          type: "question" as const,
        })),
      );
      const nextAnswers = shuffle(
        roundCards.map((card) => ({
          cardId: card.id,
          text: card.answer,
          tileId: `a-${card.id}`,
          type: "answer" as const,
        })),
      );
      const allTiles = [...nextQuestions, ...nextAnswers];
      const nextStates: Record<string, TileState> = {};

      for (const tile of allTiles) {
        nextStates[tile.tileId] = "idle";
      }

      setQuestionTiles(nextQuestions);
      setAnswerTiles(nextAnswers);
      setTileMap(new Map(allTiles.map((tile) => [tile.tileId, tile])));
      setTileStates(nextStates);
      setSelectedTileId(null);
      setMatchedCount(0);
      mismatchRef.current = {};
      lockedRef.current = false;
    },
    [getRoundCards],
  );

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const roundCards = getRoundCards(roundIndex);
    if (roundCards.length === 0 || matchedCount < roundCards.length) {
      return;
    }

    const results = roundCards.map((card) => ({
      cardId: card.id,
      mismatches: mismatchRef.current[card.id] ?? 0,
    }));
    setAllResults((current) => [...current, ...results]);

    for (const result of results) {
      fetch(`/api/study/decks/${deckId}/rate`, {
        body: JSON.stringify({
          cardId: result.cardId,
          mode: "visual",
          sessionId: sessionIdRef.current,
          verdict: verdictFromMismatchCount(result.mismatches),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
        .then((response) => response.json())
        .then((data: { sessionId?: string }) => {
          if (data.sessionId) {
            sessionIdRef.current = data.sessionId;
          }
        })
        .catch(() => undefined);
    }

    const timeout = window.setTimeout(() => {
      const nextRound = roundIndex + 1;
      if (nextRound >= totalRounds) {
        setPhase("summary");
      } else {
        setRoundIndex(nextRound);
        buildRound(nextRound);
      }
    }, 650);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [buildRound, deckId, getRoundCards, matchedCount, phase, roundIndex, totalRounds]);

  function onTileClick(tileId: string) {
    if (lockedRef.current) {
      return;
    }

    const nextState = tileStates[tileId];
    if (nextState === "matched" || nextState === "wrong") {
      return;
    }

    const tile = tileMap.get(tileId);
    if (!tile) {
      return;
    }

    if (!selectedTileId) {
      setSelectedTileId(tileId);
      setTileStates((current) => ({ ...current, [tileId]: "selected" }));
      return;
    }

    if (selectedTileId === tileId) {
      setSelectedTileId(null);
      setTileStates((current) => ({ ...current, [tileId]: "idle" }));
      return;
    }

    const selectedTile = tileMap.get(selectedTileId);
    if (!selectedTile) {
      setSelectedTileId(null);
      return;
    }

    if (selectedTile.type === tile.type) {
      setTileStates((current) => ({
        ...current,
        [selectedTileId]: "idle",
        [tileId]: "selected",
      }));
      setSelectedTileId(tileId);
      return;
    }

    if (selectedTile.cardId === tile.cardId) {
      setTileStates((current) => ({
        ...current,
        [selectedTileId]: "matched",
        [tileId]: "matched",
      }));
      setSelectedTileId(null);
      setMatchedCount((current) => current + 1);
      return;
    }

    lockedRef.current = true;
    const prevSelectedId = selectedTileId;
    setTileStates((current) => ({
      ...current,
      [prevSelectedId]: "wrong",
      [tileId]: "wrong",
    }));
    setSelectedTileId(null);
    mismatchRef.current = {
      ...mismatchRef.current,
      [selectedTile.cardId]: (mismatchRef.current[selectedTile.cardId] ?? 0) + 1,
      [tile.cardId]: (mismatchRef.current[tile.cardId] ?? 0) + 1,
    };

    window.setTimeout(() => {
      setTileStates((current) => ({
        ...current,
        [prevSelectedId]: "idle",
        [tileId]: "idle",
      }));
      lockedRef.current = false;
    }, 650);
  }

  function restart() {
    sessionIdRef.current = null;
    setAllResults([]);
    setRoundIndex(0);
    setPhase("playing");
    buildRound(0);
  }

  if (phase === "summary") {
    const totalPairs = allResults.length;
    const firstTry = allResults.filter((result) => result.mismatches === 0).length;

    return (
      <section className="study-summary panel">
        <h2>Match Complete</h2>
        <div className="study-summary-scores">
          <span>First try {firstTry}</span>
          <span>Retry needed {Math.max(0, totalPairs - firstTry)}</span>
        </div>
        <div className="inline-actions">
          <button className="secondary" onClick={restart} type="button">
            Play Again
          </button>
          <Link className="button-link" href={`/study/decks/${deckId}${filter ? `?filter=${filter}` : ""}`}>
            Back to Deck
          </Link>
        </div>
      </section>
    );
  }

  const roundCards = getRoundCards(roundIndex);
  const progress = Math.min((roundIndex * ROUND_SIZE + matchedCount) / orderedCards.length, 1);

  return (
    <section className="study-match">
      <div className="study-progress">
        <div className="study-progress__bar">
          <div className="study-progress__fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="study-progress__label">
          Round {roundIndex + 1} of {totalRounds} · {matchedCount} / {roundCards.length}
        </span>
      </div>

      <div className="study-match-columns">
        <div className="study-match-column">
          {questionTiles.map((tile) => {
            const state = tileStates[tile.tileId] ?? "idle";
            return (
              <button
                aria-pressed={state === "selected"}
                className={`study-match-tile study-match-tile--${state}`}
                disabled={state === "matched"}
                key={tile.tileId}
                onClick={() => onTileClick(tile.tileId)}
                type="button"
              >
                <span className="study-match-tile__label">Term</span>
                <span className="study-match-tile__text">{tile.text}</span>
              </button>
            );
          })}
        </div>

        <div className="study-match-column">
          {answerTiles.map((tile) => {
            const state = tileStates[tile.tileId] ?? "idle";
            return (
              <button
                aria-pressed={state === "selected"}
                className={`study-match-tile study-match-tile--${state}`}
                disabled={state === "matched"}
                key={tile.tileId}
                onClick={() => onTileClick(tile.tileId)}
                type="button"
              >
                <span className="study-match-tile__label">Definition</span>
                <span className="study-match-tile__text">{tile.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
