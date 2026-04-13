import { sendTextToCursorComposer } from "./cursorComposerSend";

export type AgentComposerInjectOutcome =
	| { ok: true }
	| {
			ok: false;
			reason: "cdp" | "script";
			step?: string;
			detail?: string;
	  };

/**
 * Sends text into the Cursor agent composer using WebSocket CDP + Input.insertText,
 * matching len-cursor's CommandExecutor.sendMessage (focus, clear, insert, Enter).
 */
export async function injectTextIntoAgentComposer(
	cdpUrl: string,
	text: string,
): Promise<AgentComposerInjectOutcome> {
	try {
		await sendTextToCursorComposer(cdpUrl, text);
		return { ok: true };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return {
			ok: false,
			reason: "cdp",
			detail: msg,
		};
	}
}
