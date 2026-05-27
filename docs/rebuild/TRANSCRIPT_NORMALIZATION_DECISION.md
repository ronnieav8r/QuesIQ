# Transcript Normalization Decision

Date: 2026-05-27

## Decision

Add a deterministic transcript-normalization layer before post-session evaluation and debrief analysis.

The Realtime transcript stream frequently fragments a user's speech into many small consecutive chunks. Evaluation quality is expected to improve if those chunks are normalized into cleaner conversational turns before being sent into post-session AI analysis.

This normalization should be script-driven rather than handled by another LLM call.

## Goals

- Reduce transcript fragmentation noise
- Improve STAR-pattern recognition and conversational continuity
- Reduce token waste from fragmented transcript payloads
- Preserve evaluation realism without rewriting what the user actually said
- Keep raw transcripts available separately for replay/debugging/audit purposes

## Planned Behavior

The normalization layer should:

- Merge adjacent same-speaker transcript fragments
- Collapse duplicate/interim STT partials when confidence is high
- Preserve ordering and timestamps
- Preserve pauses/interruption markers where useful
- Avoid rewriting or improving candidate wording
- Produce a normalized transcript artifact for evaluation/debrief prompts

## Important Constraint

Normalization is intended to improve readability and coherence, not artificially improve candidate communication quality.

The raw transcript remains the source-of-truth artifact.

## Architecture Direction

Recommended transcript flow:

1. Raw Realtime transcript
2. Deterministic normalization script
3. Normalized transcript artifact
4. Evaluation/debrief AI analysis
5. Stored evaluation + coaching outputs

This reduces repeated full-context AI cleanup passes and keeps transcript preprocessing deterministic and explainable.
