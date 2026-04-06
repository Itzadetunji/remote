export type AgentPhase = "running" | "idle" | "ambiguous" | "unavailable";

export type DomSnapshot = {
  phase: AgentPhase;
  hasStop: boolean;
  hasMic: boolean;
  hasSend: boolean;
  seenAt: number;
};

export type DomWatcherEvent =
  | { type: "taskStarted"; snapshot: DomSnapshot }
  | { type: "taskFinished"; snapshot: DomSnapshot };
