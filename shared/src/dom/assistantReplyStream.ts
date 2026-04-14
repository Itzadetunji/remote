/**
 * Polls the Cursor workbench DOM for the last assistant message (same structure as len-cursor
 * dom-extractor: [data-flat-index], data-message-role="ai", data-message-kind="assistant", .markdown-root).
 */

import { randomUUID } from "node:crypto";
import type { CdpWebSocketClient } from "./cdpWebSocketClient";
import {
	createConnectedWorkbenchClient,
	runComposerSend,
} from "./cursorComposerSend";

const POLL_MS = 400;
const STABLE_POLLS_TO_FINISH = 4;
const MAX_POLLS = 300;
/** Max polls waiting for DOM to diverge from pre-send snapshot (~20s). */
const WAIT_FOR_CHANGE_POLLS = 50;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns the last assistant bubble in document order (len-cursor assistant branch).
 */
function buildExtractLastAssistantExpression(): string {
	return `
(() => {
  try {
    const flats = Array.from(document.querySelectorAll("[data-flat-index]"));
    let last = null;
    for (const wrapper of flats) {
      const msgEl = wrapper.querySelector("[data-message-role]") || wrapper;
      if (msgEl.getAttribute("data-message-role") !== "ai") continue;
      if (msgEl.getAttribute("data-message-kind") !== "assistant") continue;
      const markdownRoot = wrapper.querySelector(".markdown-root");
      const text = (markdownRoot?.textContent || wrapper.textContent || "").trim();
      const id = msgEl.getAttribute("data-message-id") || "";
      last = { id, text };
    }
    return last || { id: "", text: "" };
  } catch (e) {
    return { id: "", text: "", error: String(e) };
  }
})()
`;
}

export type AssistantSnapshot = { id: string; text: string };

async function readAssistantSnapshot(
	client: CdpWebSocketClient,
): Promise<AssistantSnapshot> {
	const raw = (await client.evaluate(
		buildExtractLastAssistantExpression(),
	)) as AssistantSnapshot & { error?: string };
	return { id: raw?.id ?? "", text: raw?.text ?? "" };
}

export type StreamChunkPayload = {
	id: string;
	text: string;
	conversationId: string;
	createdAt: number;
	done: boolean;
};

/**
 * Sends the user message, then polls CDP for the latest assistant reply and invokes `onChunk`
 * whenever the visible text changes (streaming), and once with `done: true` when the reply stabilizes.
 */
export async function injectAndStreamAssistantReply(
	cdpUrl: string,
	userText: string,
	conversationId: string,
	onChunk: (payload: StreamChunkPayload) => void,
): Promise<void> {
	const client = await createConnectedWorkbenchClient(cdpUrl);
	const streamMessageId = randomUUID();
	const createdAt = Date.now();

	try {
		const pre = await readAssistantSnapshot(client);
		await runComposerSend(client, userText);

		let lastEmitted = "";
		let stable = 0;
		let started = false;
		let pollsSinceSend = 0;

		for (let i = 0; i < MAX_POLLS; i++) {
			await sleep(POLL_MS);
			pollsSinceSend++;
			const snap = await readAssistantSnapshot(client);

			const changedFromPre =
				snap.text !== pre.text || snap.id !== pre.id;
			if (!started) {
				if (!changedFromPre && pollsSinceSend < WAIT_FOR_CHANGE_POLLS) {
					continue;
				}
				if (!changedFromPre) {
					onChunk({
						id: streamMessageId,
						text: "(No assistant reply detected in the agent panel.)",
						conversationId,
						createdAt,
						done: true,
					});
					return;
				}
				started = true;
			}

			if (snap.text === lastEmitted) {
				if (lastEmitted.length > 0) {
					stable++;
				}
				if (
					stable >= STABLE_POLLS_TO_FINISH &&
					(lastEmitted.length > 0 || started)
				) {
					onChunk({
						id: streamMessageId,
						text: lastEmitted,
						conversationId,
						createdAt,
						done: true,
					});
					return;
				}
			} else {
				stable = 0;
				lastEmitted = snap.text;
				onChunk({
					id: streamMessageId,
					text: lastEmitted,
					conversationId,
					createdAt,
					done: false,
				});
			}
		}

		onChunk({
			id: streamMessageId,
			text: lastEmitted,
			conversationId,
			createdAt,
			done: true,
		});
	} finally {
		client.disconnect();
	}
}
