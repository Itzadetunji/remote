import { URL } from "node:url";
import type { DomSnapshot } from "./types";

type CdpClient = {
  Runtime: {
    enable: () => Promise<void>;
    evaluate: (params: {
      expression: string;
      returnByValue: boolean;
      awaitPromise: boolean;
    }) => Promise<{ result?: { value?: unknown } }>;
  };
  close: () => Promise<void>;
};

/** CommonJS export: callable connect + `.List` (no `.default`). */
type ChromeRemoteInterface = ((
  options: { host: string; port: number; target: string },
) => Promise<CdpClient>) & {
  List: (options: {
    host: string;
    port: number;
    secure: boolean;
  }) => Promise<Array<{ id: string; type: string }>>;
};

function parseCdpUrl(cdpUrl: string): { host: string; port: number; secure: boolean } {
  const parsed = new URL(cdpUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === "https:" ? "443" : "80")),
    secure: parsed.protocol === "https:"
  };
}

function isSnapshotLike(value: unknown): value is DomSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<DomSnapshot>;
  return (
    typeof candidate.phase === "string" &&
    typeof candidate.hasStop === "boolean" &&
    typeof candidate.hasMic === "boolean" &&
    typeof candidate.hasSend === "boolean" &&
    typeof candidate.seenAt === "number"
  );
}

export type DomProbeFailureReason =
  | "no_targets"
  | "no_page_target"
  | "invalid_result"
  | "cdp_error";

export type DomProbeOutcome =
  | { ok: true; snapshot: DomSnapshot }
  | { ok: false; reason: DomProbeFailureReason; detail?: string };

/**
 * Runs the probe and returns whether the snapshot is usable, or why not (for debugging).
 */
export async function runDomProbeOutcome(
  cdpUrl: string,
  expression: string
): Promise<DomProbeOutcome> {
  const parsed = parseCdpUrl(cdpUrl);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CDP = require("chrome-remote-interface") as ChromeRemoteInterface;
  try {
    const targets = await CDP.List(parsed);
    if (!targets.length) {
      return { ok: false, reason: "no_targets" };
    }
    const target = targets.find((item) => item.type === "page") ?? targets[0];
    if (!target) {
      return { ok: false, reason: "no_page_target" };
    }

    const client = await CDP({
      host: parsed.host,
      port: parsed.port,
      target: target.id
    });

    try {
      await client.Runtime.enable();
      const evaluated = await client.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: false
      });
      const value = evaluated.result?.value;
      if (!isSnapshotLike(value)) {
        return {
          ok: false,
          reason: "invalid_result",
          detail: value === undefined ? "evaluate returned undefined" : "evaluate did not return a DomSnapshot shape"
        };
      }
      return { ok: true, snapshot: value };
    } finally {
      await client.close();
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "cdp_error", detail: msg };
  }
}

export async function runDomProbe(cdpUrl: string, expression: string): Promise<DomSnapshot | undefined> {
  const outcome = await runDomProbeOutcome(cdpUrl, expression);
  return outcome.ok ? outcome.snapshot : undefined;
}
