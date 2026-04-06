import { AgentStateMachine } from "./agentStateMachine";
import { buildDomProbeExpression } from "./probeScript";
import { runDomProbeOutcome } from "./probeRunner";
import { makeScopeKey } from "./scopeContext";
import { DOM_SELECTORS } from "./selectors";
import type { DomWatcherEvent } from "./types";

export type DomWatcherOptions = {
  log?: (message: string) => void;
  getCdpUrl: () => string;
  pollMs: number;
  enabled: boolean;
  minStableIdleSamples?: number;
  onEvent?: (event: DomWatcherEvent) => void;
  /**
   * Log every poll with phase + state machine (verbose). Env: CURSOR_REMOTE_DOM_TRACE=true
   */
  domTrace?: boolean;
  /**
   * Log a summary line every N ms when domTrace is false (0 = off). Default 20000.
   */
  domHeartbeatMs?: number;
};

const MAX_SCOPED_MACHINES = 50;

export function startDomWatcher(options: DomWatcherOptions): () => void {
  if (!options.enabled) {
    return () => {};
  }

  const expression = buildDomProbeExpression(DOM_SELECTORS);
  const machines = new Map<string, AgentStateMachine>();

  const domTrace = options.domTrace ?? false;
  const domHeartbeatMs = options.domHeartbeatMs ?? 20_000;
  let lastHeartbeatLogAt = 0;
  let lastFailureLogAt = 0;
  let consecutiveFailures = 0;
  let firstOkProbeLogged = false;
  let lastScopeKey: string | undefined;

  const tick = async (): Promise<void> => {
    const outcome = await runDomProbeOutcome(options.getCdpUrl(), expression);
    const now = Date.now();

    if (!outcome.ok) {
      consecutiveFailures += 1;
      const detail = outcome.detail ? ` detail=${outcome.detail}` : "";
      if (domTrace) {
        options.log?.(
          `[taskFinish] domTrace probe failed reason=${outcome.reason}${detail}`
        );
      } else {
        const shouldLogFailure =
          consecutiveFailures === 1 ||
          (domHeartbeatMs > 0 &&
            now - lastFailureLogAt >= domHeartbeatMs);
        if (shouldLogFailure) {
          lastFailureLogAt = now;
          options.log?.(
            `[taskFinish] domProbe failed reason=${outcome.reason}${detail} — check: Cursor launched with --remote-debugging-port, chat panel open, selectors in shared/src/dom/selectors.ts`
          );
        }
      }
      return;
    }

    consecutiveFailures = 0;

    const { snapshot, scope } = outcome;
    const scopeKey = makeScopeKey(scope);

    if (scopeKey !== lastScopeKey) {
      options.log?.(
        `[taskFinish] scope changed ${lastScopeKey ?? "∅"} → ${scopeKey} target=${scope.targetId.slice(0, 8)}… tab="${scope.tabTitle ?? "?"}" composer=${scope.composerId || "unknown"}`
      );
      lastScopeKey = scopeKey;
    }

    if (!firstOkProbeLogged) {
      firstOkProbeLogged = true;
      lastHeartbeatLogAt = now;
      options.log?.(
        `[taskFinish] first probe ok scope=${scopeKey} phase=${snapshot.phase} hasStop=${snapshot.hasStop} hasMic=${snapshot.hasMic} hasSend=${snapshot.hasSend} (if phase stays unavailable/ambiguous, update DOM selectors)`
      );
    }

    let machine = machines.get(scopeKey);
    if (!machine) {
      if (machines.size >= MAX_SCOPED_MACHINES) {
        const first = machines.keys().next().value;
        if (first) {
          machines.delete(first);
        }
      }
      machine = new AgentStateMachine({
        minStableIdleSamples: options.minStableIdleSamples ?? 2
      });
      machines.set(scopeKey, machine);
    }

    const events = machine.consume(snapshot);
    const dbg = machine.getDebugState();

    if (domTrace) {
      const evNames = events.map((e) => e.type).join(",") || "none";
      options.log?.(
        `[taskFinish] domTrace scope=${scopeKey} phase=${snapshot.phase} hasStop=${snapshot.hasStop} hasMic=${snapshot.hasMic} hasSend=${snapshot.hasSend} lastStable=${dbg.lastStablePhase ?? "∅"} idleCount=${dbg.idleStableCount} events=${evNames}`
      );
    } else if (
      domHeartbeatMs > 0 &&
      now - lastHeartbeatLogAt >= domHeartbeatMs
    ) {
      lastHeartbeatLogAt = now;
      const evNames = events.map((e) => e.type).join(",") || "none";
      options.log?.(
        `[taskFinish] heartbeat scope=${scopeKey} phase=${snapshot.phase} hasStop=${snapshot.hasStop} hasMic=${snapshot.hasMic} hasSend=${snapshot.hasSend} lastStable=${dbg.lastStablePhase ?? "∅"} idleCount=${dbg.idleStableCount} events=${evNames} (taskFinished after running→idle×${options.minStableIdleSamples ?? 2})`
      );
    }

    for (const ev of events) {
      const full: DomWatcherEvent = { ...ev, scope };
      options.onEvent?.(full);
    }
  };

  const handle = setInterval(() => {
    void tick();
  }, options.pollMs);

  void tick();

  return () => {
    clearInterval(handle);
  };
}
