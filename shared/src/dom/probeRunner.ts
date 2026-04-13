import type { DomScope, DomSnapshot } from "./types";
import { evaluateOnCursorPage } from "./cdpPageEvaluate";

function isProbeResultLike(value: unknown): value is DomSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<DomSnapshot>;
  if (
    typeof candidate.phase !== "string" ||
    typeof candidate.hasStop !== "boolean" ||
    typeof candidate.hasMic !== "boolean" ||
    typeof candidate.hasSend !== "boolean" ||
    typeof candidate.seenAt !== "number"
  ) {
    return false;
  }
  if (candidate.composerId !== undefined && typeof candidate.composerId !== "string") {
    return false;
  }
  if (candidate.tabTitle !== undefined && typeof candidate.tabTitle !== "string") {
    return false;
  }
  return true;
}

export type DomProbeFailureReason =
  | "no_targets"
  | "no_page_target"
  | "invalid_result"
  | "cdp_error";

export type DomProbeOutcome =
  | { ok: true; snapshot: DomSnapshot; scope: DomScope }
  | { ok: false; reason: DomProbeFailureReason; detail?: string };

/**
 * Runs the probe and returns whether the snapshot is usable, or why not (for debugging).
 */
export async function runDomProbeOutcome(
  cdpUrl: string,
  expression: string
): Promise<DomProbeOutcome> {
  const evaluated = await evaluateOnCursorPage(cdpUrl, expression);
  if (!evaluated.ok) {
    return {
      ok: false,
      reason: evaluated.reason,
      detail: evaluated.detail
    };
  }
  const value = evaluated.value;
  if (!isProbeResultLike(value)) {
    return {
      ok: false,
      reason: "invalid_result",
      detail:
        value === undefined
          ? "evaluate returned undefined"
          : "evaluate did not return a DomSnapshot shape"
    };
  }
  const snapshot = value as DomSnapshot;
  const composerId = snapshot.composerId?.trim() ?? "";
  const tabRaw = snapshot.tabTitle?.trim() ?? "";
  const scope: DomScope = {
    targetId: evaluated.targetId,
    composerId,
    tabTitle: tabRaw.length > 0 ? tabRaw : undefined
  };
  return { ok: true, snapshot, scope };
}

export async function runDomProbe(cdpUrl: string, expression: string): Promise<DomSnapshot | undefined> {
  const outcome = await runDomProbeOutcome(cdpUrl, expression);
  return outcome.ok ? outcome.snapshot : undefined;
}
