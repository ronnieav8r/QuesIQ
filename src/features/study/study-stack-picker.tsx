"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Eye, Headphones, Layers, ListChecks, Shuffle, Volume2, X } from "lucide-react";

type Filter = "all" | "due" | "weak";
type HandsFreeMode = "answer" | "memorize";
type Modality = "handsfree" | "visual";
type OrderMode = "ordered" | "random";
type QueueMode = "once" | "srs";

type Props = {
  readyCount: number;
  stackId: string;
  totalCount: number;
  weakCount: number;
};

function buildUrl(
  stackId: string,
  filter: Filter,
  modality: Modality,
  orderMode: OrderMode,
  queueMode: QueueMode,
  handsFreeMode: HandsFreeMode = "answer",
) {
  const search = new URLSearchParams();
  search.set("filter", filter);
  search.set("order", orderMode);
  if (queueMode === "srs") {
    search.set("srs", "1");
  }
  if (modality === "handsfree") {
    if (handsFreeMode === "memorize") {
      return `/study/stacks/${stackId}/study/memorize?${search.toString()}`;
    }
    search.set("hf", "1");
    return `/study/stacks/${stackId}/study/verbal?${search.toString()}`;
  }
  return `/study/stacks/${stackId}/study?${search.toString()}`;
}

export function StudyStackPicker({ readyCount, stackId, totalCount, weakCount }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [modality, setModality] = useState<Modality | null>(null);
  const [orderMode, setOrderMode] = useState<OrderMode | null>(null);
  const [queueMode, setQueueMode] = useState<QueueMode>("once");

  if (!orderMode) {
    return (
      <div className="study-stack-study-actions">
        <button onClick={() => setOrderMode("random")} type="button">
          <Shuffle size={14} aria-hidden="true" />
          Study Stack Random
        </button>
        <button onClick={() => setOrderMode("ordered")} type="button">
          <ListChecks size={14} aria-hidden="true" />
          Study Stack Ordered
        </button>
      </div>
    );
  }

  if (!modality) {
    return (
      <section className="study-picker study-picker--open panel">
        <div className="study-picker__header">
          <h3>{orderMode === "ordered" ? "Deck Order" : "Random"}</h3>
          <button className="secondary" onClick={() => setOrderMode(null)} type="button">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="study-picker__modalities segmented-control">
          <button onClick={() => setModality("handsfree")} type="button">
            <Headphones size={16} aria-hidden="true" /> Hands-Free
          </button>
          <button onClick={() => setModality("visual")} type="button">
            <Eye size={16} aria-hidden="true" /> Visual
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="study-picker study-picker--open panel">
      <div className="study-picker__header">
        <h3>{modality === "handsfree" ? "Hands-Free" : "Visual"}</h3>
        <button
          className="secondary"
          onClick={() => {
            setModality(null);
            setOrderMode(null);
          }}
          type="button"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="study-picker__filters pill-grid">
        <button className={filter === "all" ? "" : "secondary"} onClick={() => setFilter("all")} type="button">
          All cards ({totalCount})
        </button>
        <button
          className={filter === "due" ? "" : "secondary"}
          disabled={readyCount === 0}
          onClick={() => setFilter("due")}
          type="button"
        >
          Ready for review ({readyCount})
        </button>
        <button
          className={filter === "weak" ? "" : "secondary"}
          disabled={weakCount === 0}
          onClick={() => setFilter("weak")}
          type="button"
        >
          Weak cards ({weakCount})
        </button>
      </div>
      <div className="study-picker__queue-toggle segmented-control">
        <button className={queueMode === "once" ? "active" : ""} onClick={() => setQueueMode("once")} type="button">
          One Pass
        </button>
        <button className={queueMode === "srs" ? "active" : ""} onClick={() => setQueueMode("srs")} type="button">
          Smart Review
        </button>
      </div>
      {modality === "handsfree" ? (
        <div className="study-picker__mode-cards">
          <Link
            className="study-picker__mode-card"
            href={buildUrl(stackId, filter, modality, orderMode, queueMode, "answer")}
          >
            <span className="study-picker__mode-card-icon"><Layers size={18} aria-hidden="true" /></span>
            <span className="study-picker__mode-card-info">
              <strong>Answer Out Loud</strong>
              <small>Que asks, you answer</small>
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
          <Link
            className="study-picker__mode-card"
            href={buildUrl(stackId, filter, modality, orderMode, queueMode, "memorize")}
          >
            <span className="study-picker__mode-card-icon"><Volume2 size={18} aria-hidden="true" /></span>
            <span className="study-picker__mode-card-info">
              <strong>Memorize</strong>
              <small>Listen to each card and answer</small>
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <Link className="button-link study-picker__launch" href={buildUrl(stackId, filter, modality, orderMode, queueMode)}>
          Start Visual Stack
        </Link>
      )}
    </section>
  );
}
