import { AgentStateMachine } from "./agentStateMachine";
import { buildDomProbeExpression } from "./probeScript";
import { runDomProbe } from "./probeRunner";
import { DOM_SELECTORS } from "./selectors";
import type { DomWatcherEvent } from "./types";

export type DomWatcherOptions = {
  log?: (message: string) => void;
  getCdpUrl: () => string;
  pollMs: number;
  enabled: boolean;
  minStableIdleSamples?: number;
  onEvent?: (event: DomWatcherEvent) => void;
};

export function startDomWatcher(options: DomWatcherOptions): () => void {
  if (!options.enabled) {
    return () => {};
  }

  const expression = buildDomProbeExpression(DOM_SELECTORS);
  const machine = new AgentStateMachine({
    minStableIdleSamples: options.minStableIdleSamples ?? 2
  });

  const tick = async (): Promise<void> => {
    let snapshot;
    try {
      snapshot = await runDomProbe(options.getCdpUrl(), expression);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.log?.(`[Cursor Remote] DOM watcher tick failed: ${message}`);
      return;
    }

    if (!snapshot) {
      return;
    }

    const events = machine.consume(snapshot);
    for (const event of events) {
      options.onEvent?.(event);
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
