/**
 * Evaluated in the Cursor workbench page via CDP Runtime.evaluate.
 * Returns `{ busy: boolean }`. Heuristic: visible **Stop** control usually means an agent/stream is active.
 * Tune as Cursor’s UI changes.
 */
export const AGENT_BUSY_PROBE_EXPRESSION = `
(() => {
  try {
    const buttons = Array.from(document.querySelectorAll('button'));
    const stopLike = buttons.some((b) => {
      if (b.offsetParent === null) return false;
      const label = (b.getAttribute('aria-label') || '') + (b.textContent || '');
      return /\\bstop\\b/i.test(label);
    });
    return { busy: stopLike };
  } catch (e) {
    return { busy: false };
  }
})()
`;
