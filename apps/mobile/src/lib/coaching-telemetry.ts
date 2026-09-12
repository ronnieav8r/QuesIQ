import {
  coachingServerTimingSchema,
  coachingTimingObservationSchema,
  type CoachingTelemetry,
  type CoachingTimingObservation,
} from "@quesiq/interview-contracts";

type Kind = CoachingTimingObservation["kind"];
type Failure = NonNullable<CoachingTimingObservation["failure"]>;
type Runtime = NonNullable<CoachingTimingObservation["runtime"]>;
type Stage = keyof CoachingTimingObservation["stages"];

const now = () => typeof performance !== "undefined" ? performance.now() : Number.NaN;

/** Bounded client diagnostics. These observations never retain learner content. */
export class CoachingTelemetryRecorder {
  private observations: CoachingTimingObservation[] = [];
  private startedAt = new Map<string, number>();
  private sequence = 0;
  private dropped = 0;
  private readonly prefix = `coaching-${Math.random().toString(36).slice(2, 10)}`;

  begin(kind: Kind, turnIndex: number, recoveryOf?: string) {
    const startedAt = now();
    if (this.observations.length >= 200 || !Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex > 50 || !Number.isFinite(startedAt)) {
      this.dropped = Math.min(Number.MAX_SAFE_INTEGER, this.dropped + 1);
      return undefined;
    }
    const id = `${this.prefix}-${++this.sequence}`;
    this.observations.push({
      id,
      turnIndex,
      kind,
      ...(recoveryOf ? { recoveryOf } : {}),
      outcome: "pending",
      stages: {},
    });
    this.startedAt.set(id, startedAt);
    return id;
  }

  mark(id: string | undefined, stage: Stage, value = now()) {
    const observation = this.findMutable(id);
    if (!observation || observation.stages[stage] !== undefined) return;
    const startedAt = this.startedAt.get(id!);
    if (startedAt === undefined) return;
    const elapsed = value - startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 3_600_000) return;
    observation.stages[stage] = Math.round(elapsed);
  }

  markAtStart(id: string | undefined, stage: Stage) {
    const observation = this.findMutable(id);
    if (observation && observation.stages[stage] === undefined) observation.stages[stage] = 0;
  }

  attachServer(id: string | undefined, candidate: unknown) {
    const observation = this.findMutable(id);
    const parsed = coachingServerTimingSchema.safeParse(candidate);
    if (observation && parsed.success && !observation.server) observation.server = parsed.data;
  }

  attachRuntime(id: string | undefined, runtime: Runtime | undefined) {
    const observation = this.findMutable(id);
    const parsed = coachingTimingObservationSchema.shape.runtime.safeParse(runtime);
    if (observation && parsed.success && parsed.data && !observation.runtime) observation.runtime = parsed.data;
  }

  finish(id: string | undefined, outcome: Exclude<CoachingTimingObservation["outcome"], "pending">, failure?: Failure) {
    const observation = this.findMutable(id);
    if (!observation) return;
    if (observation.outcome === "audio_observed" && outcome !== "failed") return;
    if (observation.outcome !== "pending" && observation.outcome !== "audio_observed") return;
    observation.outcome = outcome;
    if (failure) observation.failure = failure;
  }

  interruptPending() {
    for (const observation of this.observations) {
      if (observation.outcome === "pending") {
        observation.outcome = "interrupted";
        observation.failure = "interrupted";
      }
    }
  }

  snapshot(): CoachingTelemetry {
    return {
      version: 1,
      ...(this.dropped ? { droppedObservations: this.dropped } : {}),
      observations: this.observations.map((observation) => ({
        ...observation,
        stages: { ...observation.stages },
        ...(observation.server ? { server: { ...observation.server, stages: { ...observation.server.stages }, providerRequestIds: { ...observation.server.providerRequestIds } } } : {}),
        ...(observation.runtime ? { runtime: { ...observation.runtime } } : {}),
      })),
    };
  }

  kindOf(id: string | undefined): Kind | undefined {
    return this.observations.find((entry) => entry.id === id)?.kind;
  }

  private findMutable(id: string | undefined) {
    if (!id) return undefined;
    const observation = this.observations.find((entry) => entry.id === id);
    return observation?.outcome === "pending" || observation?.outcome === "audio_observed" ? observation : undefined;
  }
}
