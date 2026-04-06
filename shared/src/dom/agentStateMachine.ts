import type { DomSnapshot } from "./types";

export type AgentStateMachineOptions = {
  minStableIdleSamples: number;
};

/** Transitions before attaching CDP/tab scope in the watcher. */
export type AgentTransitionEvent =
  | { type: "taskStarted"; snapshot: DomSnapshot }
  | { type: "taskFinished"; snapshot: DomSnapshot };

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

  /** For debugging: why taskFinished may not fire yet. */
  public getDebugState(): {
    lastStablePhase: DomSnapshot["phase"] | undefined;
    idleStableCount: number;
  } {
    return {
      lastStablePhase: this.lastStablePhase,
      idleStableCount: this.idleStableCount
    };
  }

  public consume(snapshot: DomSnapshot): AgentTransitionEvent[] {
    const events: AgentTransitionEvent[] = [];

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
