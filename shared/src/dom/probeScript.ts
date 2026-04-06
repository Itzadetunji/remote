import type { DomSelectors } from "./selectors";

export function buildDomProbeExpression(selectors: DomSelectors): string {
  const encodedSelectors = JSON.stringify(selectors);

  return `
(() => {
  try {
    const selectors = ${encodedSelectors};
    const box = document.querySelector(selectors.inputContainer);
    if (!box) {
      return {
        phase: "unavailable",
        hasStop: false,
        hasMic: false,
        hasSend: false,
        seenAt: Date.now()
      };
    }

    const hasStop = !!box.querySelector(selectors.stopButton) || !!box.querySelector(selectors.stopIcon);
    const hasMic = !!box.querySelector(selectors.micButton) || !!box.querySelector(selectors.micIcon);
    const hasSend = !!box.querySelector(selectors.sendIcon);

    let phase = "ambiguous";
    if (hasStop) {
      phase = "running";
    } else if (hasMic || hasSend) {
      phase = "idle";
    }

    return {
      phase,
      hasStop,
      hasMic,
      hasSend,
      seenAt: Date.now()
    };
  } catch (_error) {
    return {
      phase: "unavailable",
      hasStop: false,
      hasMic: false,
      hasSend: false,
      seenAt: Date.now()
    };
  }
})()
`;
}
