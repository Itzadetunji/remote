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

export async function runDomProbe(cdpUrl: string, expression: string): Promise<DomSnapshot | undefined> {
  const parsed = parseCdpUrl(cdpUrl);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CDP = require("chrome-remote-interface") as ChromeRemoteInterface;
  const targets = await CDP.List(parsed);
  const target = targets.find((item) => item.type === "page") ?? targets[0];
  if (!target) {
    return undefined;
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
      return undefined;
    }
    return value;
  } finally {
    await client.close();
  }
}
