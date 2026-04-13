/**
 * Minimal CDP client over WebSocket (same approach as len-cursor's cdp-client).
 * Connects to a page target's webSocketDebuggerUrl — avoids browser-level CDP calls
 * that Electron/Cursor may block when using some higher-level clients.
 */

import { WebSocket } from "ws";

const DEFAULT_TIMEOUT_MS = 10000;

interface CdpMessage {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	result?: Record<string, unknown>;
	error?: { code: number; message: string; data?: string };
}

interface PendingCall {
	resolve: (value: Record<string, unknown>) => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class CdpWebSocketClient {
	private ws: WebSocket | null = null;
	private nextId = 1;
	private pending = new Map<number, PendingCall>();
	private _connected = false;

	async connect(wsUrl: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(wsUrl);

			this.ws.on("open", () => {
				this._connected = true;
				resolve();
			});

			this.ws.on("error", (err: Error) => {
				if (!this._connected) {
					reject(err);
				}
			});

			this.ws.on("message", (data) => {
				this.handleMessage(data.toString());
			});

			this.ws.on("close", () => {
				this._connected = false;
				this.rejectAllPending("WebSocket closed");
			});
		});
	}

	disconnect(): void {
		this._connected = false;
		this.rejectAllPending("Intentional disconnect");
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	isConnected(): boolean {
		return this._connected;
	}

	async send(
		method: string,
		params?: Record<string, unknown>,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	): Promise<Record<string, unknown>> {
		if (!this.ws || !this._connected) {
			throw new Error("CDP client not connected");
		}

		const id = this.nextId++;
		const socket = this.ws;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`CDP timeout for ${method} (${timeoutMs}ms)`));
			}, timeoutMs);

			this.pending.set(id, { resolve, reject, timer });
			socket.send(JSON.stringify({ id, method, params }));
		});
	}

	async evaluate(expression: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
		const result = await this.send(
			"Runtime.evaluate",
			{
				expression,
				returnByValue: true,
				awaitPromise: true,
			},
			timeoutMs,
		);

		const exceptionDetails = result.exceptionDetails as
			| { text?: string; exception?: { description?: string } }
			| undefined;
		if (exceptionDetails) {
			const msg =
				exceptionDetails.exception?.description ??
				exceptionDetails.text ??
				"Evaluation failed";
			throw new Error(msg);
		}

		const remoteObj = result.result as { value?: unknown } | undefined;
		return remoteObj?.value;
	}

	async typeText(text: string): Promise<void> {
		await this.send("Input.insertText", { text });
	}

	async dispatchKeyEvent(
		type: "keyDown" | "keyUp" | "char",
		options: {
			key?: string;
			code?: string;
			text?: string;
			windowsVirtualKeyCode?: number;
			nativeVirtualKeyCode?: number;
			modifiers?: number;
		} = {},
	): Promise<void> {
		await this.send("Input.dispatchKeyEvent", { type, ...options });
	}

	async pressKey(
		key: string,
		code: string,
		keyCode: number,
		modifiers = 0,
	): Promise<void> {
		await this.dispatchKeyEvent("keyDown", {
			key,
			code,
			windowsVirtualKeyCode: keyCode,
			nativeVirtualKeyCode: keyCode,
			modifiers,
		});
		await this.dispatchKeyEvent("keyUp", {
			key,
			code,
			windowsVirtualKeyCode: keyCode,
			nativeVirtualKeyCode: keyCode,
			modifiers,
		});
	}

	private handleMessage(raw: string): void {
		let msg: CdpMessage;
		try {
			msg = JSON.parse(raw) as CdpMessage;
		} catch {
			return;
		}

		if (msg.id !== undefined && this.pending.has(msg.id)) {
			const pending = this.pending.get(msg.id);
			if (!pending) {
				return;
			}
			this.pending.delete(msg.id);
			clearTimeout(pending.timer);

			if (msg.error) {
				pending.reject(new Error(msg.error.message));
			} else {
				pending.resolve(msg.result ?? {});
			}
		}
	}

	private rejectAllPending(reason: string): void {
		for (const [id, pending] of this.pending) {
			clearTimeout(pending.timer);
			pending.reject(new Error(reason));
			this.pending.delete(id);
		}
	}
}
