import type { DomSnapshot, DomWatcherEvent } from "./types";

export type AgentStateMachineOptions = {
  minStableIdleSamples: number;
};

/**
 * Turns raw DOM snapshots into durable state transitions.
 * We only emit taskFinished after running -> idle and enough stable idle samples.
 */
export class AgentStateMachine {
  private readonly options: AgentStateMachineOptions;
  private lastStablePhase: DomSnapshot["phase"] | undefined;
  private idleStableCount = 0;

  public constructor(options: AgentStateMachineOptions) {
    this.options = options;
  }

  public consume(snapshot: DomSnapshot): DomWatcherEvent[] {
    const events: DomWatcherEvent[] = [];

    if (snapshot.phase === "running") {
      this.idleStableCount = 0;
      if (this.lastStablePhase !== "running") {
        this.lastStablePhase = "running";
        events.push({ type: "taskStarted", snapshot });
      }
      return events;
    }

    if (snapshot.phase === "idle") {
      this.idleStableCount += 1;
      if (
        this.lastStablePhase === "running" &&
        this.idleStableCount >= this.options.minStableIdleSamples
      ) {
        this.lastStablePhase = "idle";
        events.push({ type: "taskFinished", snapshot });
      } else if (this.lastStablePhase !== "running") {
        this.lastStablePhase = "idle";
      }
      return events;
    }

    // ambiguous/unavailable: preserve last stable phase and wait
    return events;
  }
}
