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
        seenAt: Date.now(),
        composerId: "",
        tabTitle: ""
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

    let composerId = "";
    let el = box;
    for (let i = 0; i < 16 && el; i++) {
      const cid = el.getAttribute && el.getAttribute("data-composer-id");
      if (cid) {
        composerId = cid;
        break;
      }
      el = el.parentElement;
    }

    let tabTitle = "";
    try {
      const cells = document.querySelectorAll(".agent-sidebar-cell");
      for (const cell of Array.from(cells)) {
        const selected =
          cell.getAttribute("data-selected") === "true" ||
          cell.getAttribute("data-highlighted") === "true" ||
          cell.classList.contains("selected") ||
          cell.classList.contains("active");
        if (selected) {
          const titleEl = cell.querySelector(".agent-sidebar-cell-text");
          tabTitle = (titleEl ? titleEl.textContent : cell.textContent || "")
            .trim()
            .substring(0, 120);
          break;
        }
      }
    } catch (_e) {
      tabTitle = "";
    }

    return {
      phase,
      hasStop,
      hasMic,
      hasSend,
      seenAt: Date.now(),
      composerId,
      tabTitle
    };
  } catch (_error) {
    return {
      phase: "unavailable",
      hasStop: false,
      hasMic: false,
      hasSend: false,
      seenAt: Date.now(),
      composerId: "",
      tabTitle: ""
    };
  }
})()
`;
}
