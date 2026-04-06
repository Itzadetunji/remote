export type DomSelectors = {
  inputContainer: string;
  stopButton: string;
  stopIcon: string;
  micButton: string;
  micIcon: string;
  sendIcon: string;
};

/**
 * Central place for Cursor DOM selectors.
 * Update here when Cursor UI classes/attributes change.
 */
export const DOM_SELECTORS: DomSelectors = {
  inputContainer: ".ai-input-full-input-box",
  stopButton: "[data-stop-button=\"true\"]",
  stopIcon: ".codicon-debug-stop",
  micButton: ".mic-icon-showing",
  micIcon: ".codicon-mic",
  sendIcon: ".codicon-arrow-up-two"
};
