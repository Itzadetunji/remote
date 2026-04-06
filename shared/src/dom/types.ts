export type AgentPhase = "running" | "idle" | "ambiguous" | "unavailable";

/** CDP page target + composer/chat identity (from DOM). */
export type DomScope = {
  /** CDP target id for this workbench page (which Cursor window). */
  targetId: string;
  /** Composer / chat session id from `data-composer-id` (empty string if unknown). */
  composerId: string;
  /** Active chat tab label from sidebar when available. */
  tabTitle?: string;
};

export type DomSnapshot = {
  phase: AgentPhase;
  hasStop: boolean;
  hasMic: boolean;
  hasSend: boolean;
  seenAt: number;
  /** Filled by in-page probe; used with targetId to scope state per tab/window. */
  composerId?: string;
  tabTitle?: string;
};

export type DomWatcherEvent =
  | { type: "taskStarted"; snapshot: DomSnapshot; scope: DomScope }
  | { type: "taskFinished"; snapshot: DomSnapshot; scope: DomScope };
