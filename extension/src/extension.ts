import * as vscode from "vscode";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import QRCode from "qrcode";
import { ConnectionStatusViewProvider } from "./views/connectionView";
import {
	checkCdpViaService,
	checkServiceHealth,
	getPairing,
	sendTestPushViaService,
} from "./services/serviceClient";

type ExtensionState = {
	serviceProcess?: ChildProcessWithoutNullStreams;
	pairedDevices: number;
};

const state: ExtensionState = {
	pairedDevices: 0,
};

function getServiceUrl(): string {
	const config = vscode.workspace.getConfiguration("cursorRemote");
	return config.get<string>("serviceUrl", "http://127.0.0.1:31337");
}

function resolveServiceEntry(context: vscode.ExtensionContext): string {
	const config = vscode.workspace.getConfiguration("cursorRemote");
	const configured = config.get<string>(
		"serviceEntryPath",
		"../server/dist/index.js",
	);
	const workspaceRoot =
		vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionPath;
	return path.resolve(workspaceRoot, configured);
}

function getAutoStartService(): boolean {
	return vscode.workspace
		.getConfiguration("cursorRemote")
		.get<boolean>("autoStartService", true);
}

/** Env passed to the spawned Node process so the service matches extension settings (CDP, DOM watcher). */
function getServiceEnvForSpawn(): NodeJS.ProcessEnv {
	const config = vscode.workspace.getConfiguration("cursorRemote");
	const cdpUrl = config.get<string>("cdpUrl", "http://127.0.0.1:9222");
	const notifyOnAgentIdle = config.get<boolean>("notifyOnAgentIdle", true);
	const agentIdlePollMs = config.get<number>("agentIdlePollMs", 500);
	const domTrace = config.get<boolean>("domTrace", false);
	const domHeartbeatMs = config.get<number>("domHeartbeatMs", 20_000);
	return {
		...process.env,
		CURSOR_REMOTE_CDP_URL: cdpUrl,
		CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE: notifyOnAgentIdle ? "true" : "false",
		CURSOR_REMOTE_AGENT_IDLE_POLL_MS: String(agentIdlePollMs),
		CURSOR_REMOTE_DOM_TRACE: domTrace ? "true" : "false",
		CURSOR_REMOTE_DOM_HEARTBEAT_MS: String(domHeartbeatMs),
	};
}

async function startService(
	context: vscode.ExtensionContext,
	output: vscode.OutputChannel,
	options: { silent?: boolean } = {},
): Promise<boolean> {
	const { silent = false } = options;
	try {
		const serviceUrl = getServiceUrl();
		if (await checkServiceHealth(serviceUrl)) {
			if (!silent) {
				void vscode.window.showInformationMessage(
					`Cursor Remote service already running at ${serviceUrl}`,
				);
			}
			return true;
		}

		const entry = resolveServiceEntry(context);
		const child = spawn(process.execPath, [entry], {
			cwd: path.dirname(entry),
			stdio: "pipe",
			env: getServiceEnvForSpawn(),
		});
		state.serviceProcess = child;
		child.stdout.on("data", (chunk) => output.append(chunk.toString()));
		child.stderr.on("data", (chunk) => output.append(chunk.toString()));
		child.on("exit", (code) => {
			output.appendLine(
				`[Cursor Remote] service exited with code ${code ?? 0}`,
			);
			state.serviceProcess = undefined;
		});

		if (!silent) {
			void vscode.window.showInformationMessage(
				"Cursor Remote service started.",
			);
		}
		return true;
	} catch (error) {
		output.appendLine(
			`[Cursor Remote] startService: ${(error as Error).message}`,
		);
		if (!silent) {
			void vscode.window.showErrorMessage(
				`Failed to start service: ${(error as Error).message}`,
			);
		}
		return false;
	}
}

async function startPairingNotificationPolling(
	output: vscode.OutputChannel,
): Promise<vscode.Disposable> {
	const tick = async (): Promise<void> => {
		const serviceUrl = getServiceUrl();
		const healthy = await checkServiceHealth(serviceUrl);
		if (!healthy) {
			return;
		}
		try {
			const pairing = await getPairing(serviceUrl);
			if (pairing.devices > state.pairedDevices) {
				void vscode.window.showInformationMessage(
					"Cursor Remote: device paired.",
				);
			}
			state.pairedDevices = pairing.devices;
		} catch (error) {
			output.appendLine(
				`[Cursor Remote] Pairing poll error: ${(error as Error).message}`,
			);
		}
	};

	const handle = setInterval(() => {
		void tick();
	}, 5000);

	await tick();
	return {
		dispose: () => clearInterval(handle),
	};
}

export async function activate(
	context: vscode.ExtensionContext,
): Promise<void> {
	const output = vscode.window.createOutputChannel("Cursor Remote");
	context.subscriptions.push(output);

	const connectionView = new ConnectionStatusViewProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			ConnectionStatusViewProvider.viewId,
			connectionView,
			{
				webviewOptions: { retainContextWhenHidden: true },
			},
		),
	);

	context.subscriptions.push(await startPairingNotificationPolling(output));

	if (getAutoStartService()) {
		void startService(context, output, { silent: true });
	}

	context.subscriptions.push(
		vscode.commands.registerCommand("cursorRemote.startServer", async () => {
			await startService(context, output, { silent: false });
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("cursorRemote.stopServer", async () => {
			if (!state.serviceProcess) {
				void vscode.window.showInformationMessage(
					"No service process started by this extension.",
				);
				return;
			}
			state.serviceProcess.kill();
			state.serviceProcess = undefined;
			void vscode.window.showInformationMessage(
				"Cursor Remote service stop requested.",
			);
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("cursorRemote.showPairingQr", async () => {
			try {
				const serviceUrl = getServiceUrl();
				const pairing = await getPairing(serviceUrl);
				const qrDataUrl = await QRCode.toDataURL(pairing.payload, {
					margin: 1,
					width: 280,
				});
				const panel = vscode.window.createWebviewPanel(
					"cursorRemotePairingQr",
					"Cursor Remote Pairing",
					vscode.ViewColumn.Active,
					{},
				);

				panel.webview.html = `
          <!doctype html>
          <html lang="en">
            <body style="font-family: sans-serif; padding: 16px;">
              <h2>Cursor Remote Pairing</h2>
              <p>Scan with your iOS app.</p>
              <img src="${qrDataUrl}" alt="Pairing QR code" />
              <p><strong>Payload:</strong> ${pairing.payload}</p>
              <p><strong>Server:</strong> ${pairing.baseUrl}</p>
              <p><strong>Paired devices:</strong> ${pairing.devices}</p>
            </body>
          </html>
        `;
			} catch (error) {
				void vscode.window.showErrorMessage(
					`Unable to show pairing QR: ${(error as Error).message}`,
				);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("cursorRemote.sendTestPush", async () => {
			try {
				const serviceUrl = getServiceUrl();
				const result = await sendTestPushViaService(serviceUrl);
				void vscode.window.showInformationMessage(
					`Push complete: sent=${result.sent}, failed=${result.failed}`,
				);
			} catch (error) {
				void vscode.window.showErrorMessage(
					`Failed to send push: ${(error as Error).message}`,
				);
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			"cursorRemote.checkCdpConnection",
			async () => {
				try {
					const serviceUrl = getServiceUrl();
					const result = await checkCdpViaService(serviceUrl);
					void vscode.window.showInformationMessage(`CDP connected: ${result}`);
				} catch (error) {
					const detail = error instanceof Error ? error.message : String(error);
					output.appendLine(`[Cursor Remote] CDP check failed: ${detail}`);
					void vscode.window.showErrorMessage(
						`Service CDP check failed: ${detail}`,
					);
				}
			},
		),
	);
}

export function deactivate(): void {
	if (state.serviceProcess) {
		state.serviceProcess.kill();
		state.serviceProcess = undefined;
	}
}
