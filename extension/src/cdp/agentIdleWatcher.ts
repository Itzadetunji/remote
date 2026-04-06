import * as vscode from "vscode";
import { URL } from "node:url";
import { AGENT_BUSY_PROBE_EXPRESSION } from "./agentProbeExpression";
import type { PairingServer } from "../services/pairingServer";
import { notifyAllPairedDevices } from "../services/pushService";

type CdpModule = {
	List: (options: { host: string; port: number; secure: boolean }) => Promise<Array<{ id: string; type: string }>>;
	default: (options: { host: string; port: number; target: string }) => Promise<{
		Runtime: {
			enable: () => Promise<void>;
			evaluate: (params: {
				expression: string;
				returnByValue: boolean;
				awaitPromise: boolean;
			}) => Promise<{ result?: { value?: unknown } }>;
		};
		close: () => Promise<void>;
	}>;
};

function parseCdpUrl(cdpUrl: string): { host: string; port: number; secure: boolean } {
	const parsed = new URL(cdpUrl);
	return {
		host: parsed.hostname,
		port: Number(parsed.port || (parsed.protocol === "https:" ? "443" : "80")),
		secure: parsed.protocol === "https:",
	};
}

async function probeAgentBusy(cdpUrl: string): Promise<boolean | undefined> {
	const parsed = parseCdpUrl(cdpUrl);
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const CDP = require("chrome-remote-interface") as CdpModule;
	const targets = await CDP.List(parsed);
	const target = targets.find((t) => t.type === "page") ?? targets[0];
	if (!target) {
		return undefined;
	}

	const client = await CDP.default({
		host: parsed.host,
		port: parsed.port,
		target: target.id,
	});

	try {
		await client.Runtime.enable();
		const result = await client.Runtime.evaluate({
			expression: AGENT_BUSY_PROBE_EXPRESSION,
			returnByValue: true,
			awaitPromise: false,
		});
		const value = result.result?.value as { busy?: boolean } | undefined;
		if (value && typeof value.busy === "boolean") {
			return value.busy;
		}
		return undefined;
	} finally {
		await client.close();
	}
}

export function startAgentIdleWatcher(options: {
	context: vscode.ExtensionContext;
	output: vscode.OutputChannel;
	getServer: () => PairingServer | undefined;
	pollMs: number;
	enabled: boolean;
}): vscode.Disposable {
	if (!options.enabled) {
		return new vscode.Disposable(() => {});
	}

	let lastBusy: boolean | undefined;
	let lastPushAt = 0;
	const minPushGapMs = 5000;

	const tick = async (): Promise<void> => {
		const server = options.getServer();
		if (!server || server.listDevices().length === 0) {
			return;
		}

		const config = vscode.workspace.getConfiguration("cursorRemote");
		const cdpUrl = config.get<string>("cdpUrl", "http://127.0.0.1:9222");

		let busy: boolean | undefined;
		try {
			busy = await probeAgentBusy(cdpUrl);
		} catch {
			return;
		}

		if (busy === undefined) {
			return;
		}

		if (lastBusy === true && busy === false) {
			const now = Date.now();
			if (now - lastPushAt >= minPushGapMs) {
				lastPushAt = now;
				void vscode.window.showInformationMessage("Cursor Remote: agent task finished (detected).");
				void notifyAllPairedDevices(options.context, server, options.output, {
					title: "Cursor Remote",
					body: "Agent task finished in Cursor.",
				});
			}
		}
		lastBusy = busy;
	};

	const handle = setInterval(() => {
		void tick();
	}, options.pollMs);

	void tick();

	return new vscode.Disposable(() => {
		clearInterval(handle);
	});
}
