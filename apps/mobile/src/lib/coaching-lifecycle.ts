/** Owns async work independently of React renders. No native dependencies. */
export class CoachingLifecycle {
  private ended = false;
  private generation = 0;
  private requests = new Set<AbortController>();
  private completedItems = new Set<string>();

  get active() { return !this.ended; }

  begin() {
    if (this.ended) return undefined;
    const generation = this.generation;
    const controller = new AbortController();
    this.requests.add(controller);
    return {
      signal: controller.signal,
      current: () => !this.ended && generation === this.generation && !controller.signal.aborted,
      release: () => this.requests.delete(controller),
      cancel: () => { controller.abort(); this.requests.delete(controller); },
    };
  }

  acceptTranscript(id?: string) {
    if (this.ended || (id && this.completedItems.has(id))) return false;
    if (id) this.completedItems.add(id);
    return true;
  }

  cancelPending() {
    this.generation += 1;
    for (const request of this.requests) request.abort();
    this.requests.clear();
  }

  finish() {
    if (this.ended) return false;
    this.ended = true;
    this.cancelPending();
    return true;
  }
}
