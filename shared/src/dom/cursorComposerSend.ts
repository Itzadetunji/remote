/**
 * Sends user text into Cursor's agent composer using the same sequence as len-cursor
 * (focus → Ctrl+A / Backspace → Input.insertText → Enter) over a WebSocket CDP session.
 */

import { CdpWebSocketClient } from "./cdpWebSocketClient";

const FOCUS_DELAY_MS = 100;
const KEY_DELAY_MS = 50;
const BEFORE_ENTER_MS = 150;

/** Order matters: specific Cursor selectors first, then len-cursor defaults. */
const CHAT_INPUT_SELECTOR_STRATEGIES: string[] = [
	".ai-input-full-input-box textarea",
	".ai-input-full-input-box [contenteditable='true']",
	"textarea[class*='input']",
	"[contenteditable='true']",
	"[role='textbox']",
	"textarea",
];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CdpJsonTarget {
	id: string;
	type: string;
	title?: string;
	url: string;
	webSocketDebuggerUrl?: string;
}

export async function fetchCdpTargets(
	cdpUrl: string,
): Promise<CdpJsonTarget[]> {
	const base = cdpUrl.replace(/\/$/, "");
	const url = `${base}/json`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);
	let response: Response;
	try {
		response = await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
	if (!response.ok) {
		throw new Error(`GET ${url} → HTTP ${response.status}`);
	}
	return (await response.json()) as CdpJsonTarget[];
}

/**
 * Prefer the VS Code workbench renderer page (same as len-cursor CDPBridge.connect).
 */
export function pickPageWebSocketUrl(
	targets: CdpJsonTarget[],
): string | undefined {
	const workbench = targets.find(
		(t) => t.type === "page" && t.url.includes("workbench"),
	);
	const page =
		workbench ??
		targets.find((t) => t.type === "page") ??
		targets[0];
	return page?.webSocketDebuggerUrl;
}

function buildFocusExpression(strategies: string[]): string {
	return `
(() => {
  const strategies = ${JSON.stringify(strategies)};
  let input = null;
  let matchedSelector = "";
  for (const sel of strategies) {
    try {
      input = document.querySelector(sel);
      if (input) { matchedSelector = sel; break; }
    } catch (_e) {}
  }
  if (!input) {
    return { ok: false, error: "Chat input not found (tried " + strategies.length + " selectors)" };
  }
  const info = input.tagName + "." + Array.from(input.classList).join(".") + " | sel=" + matchedSelector;
  input.scrollIntoView({ block: "center", behavior: "instant" });
  input.focus();
  input.click();
  return { ok: true, info };
})()
`;
}

/** Connects to the workbench page WebSocket (caller must `disconnect()`). */
export async function createConnectedWorkbenchClient(
	cdpUrl: string,
): Promise<CdpWebSocketClient> {
	const targets = await fetchCdpTargets(cdpUrl);
	const wsUrl = pickPageWebSocketUrl(targets);
	if (!wsUrl) {
		throw new Error("No CDP page target with webSocketDebuggerUrl");
	}
	const client = new CdpWebSocketClient();
	await client.connect(wsUrl);
	return client;
}

/**
 * Focus composer, clear, insert text, Enter — len-cursor CommandExecutor sequence.
 * Client must already be connected to the workbench target.
 */
export async function runComposerSend(
	client: CdpWebSocketClient,
	text: string,
): Promise<void> {
	const focusResult = (await client.evaluate(
		buildFocusExpression(CHAT_INPUT_SELECTOR_STRATEGIES),
	)) as { ok?: boolean; error?: string; info?: string } | null;

	if (!focusResult?.ok) {
		throw new Error(focusResult?.error ?? "Failed to focus chat input");
	}

	await sleep(FOCUS_DELAY_MS);

	await client.pressKey("a", "KeyA", 65, 2);
	await sleep(KEY_DELAY_MS);
	await client.pressKey("Backspace", "Backspace", 8);
	await sleep(KEY_DELAY_MS);

	await client.typeText(text);
	await sleep(BEFORE_ENTER_MS);

	await client.pressKey("Enter", "Enter", 13);
}

export async function sendTextToCursorComposer(
	cdpUrl: string,
	text: string,
): Promise<void> {
	const client = await createConnectedWorkbenchClient(cdpUrl);
	try {
		await runComposerSend(client, text);
	} finally {
		client.disconnect();
	}
}
