import { PairingServer, startDomWatcher } from "@cursorremote/shared";
import {
	notifyTaskFinished,
	sendTestPush,
	type ServerContext,
} from "./commands/handlers";
import { attachKeyboardHandlers } from "./cli/keyboard";
import { loadEnvConfig } from "./config";
import { createRegisterRoutes } from "./http/routes";
import {
	logService,
	printHelp,
	printStartupBanner,
} from "./cli/ui";

export async function main(): Promise<void> {
	const env = loadEnvConfig();

	const runtimeSecrets = new Map<string, string>();
	const secretStore = {
		get: async (key: string): Promise<string | undefined> =>
			runtimeSecrets.get(key),
		store: async (key: string, value: string): Promise<void> => {
			runtimeSecrets.set(key, value);
		},
	};

	let contextRef: ServerContext | undefined;
	function getContext(): ServerContext {
		if (!contextRef) {
			throw new Error("Server context not initialized");
		}
		return contextRef;
	}

	function log(message: string): void {
		logService(message);
	}

	const server = new PairingServer({
		host: env.host,
		port: env.port,
		pairingToken: env.pairingToken,
		onDeviceRegistered: (device) => {
			log(
				`Device paired: ${device.platform} (${device.deviceToken.slice(0, 8)}...)`,
			);
			void sendTestPush(getContext(), `Device paired: ${device.platform}`);
		},
		registerRoutes: createRegisterRoutes(getContext),
	});

	contextRef = {
		server,
		cdpUrl: env.cdpUrl,
		log,
		secretStore,
		apnsKeyPath: env.apnsKeyPath,
	};

	await server.start();
	await printStartupBanner(server);
	log(`Service listening (bind ${env.host}:${server.getPort()})`);
	printHelp();

	const minStableIdleSamples = 2;
	if (!env.notifyOnAgentIdle) {
		log(
			"[taskFinish] DOM watcher disabled — no task-finish pushes (set CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE=true or use Cursor Remote settings)",
		);
	} else {
		log(
			`[taskFinish] DOM watcher enabled cdpUrl=${env.cdpUrl} pollMs=${env.pollMs} minStableIdleSamples=${minStableIdleSamples} cooldownMs=${env.taskFinishCooldownMs} domTrace=${env.domTrace} domHeartbeatMs=${env.domHeartbeatMs}`,
		);
	}

	let lastTaskFinishPushAt = 0;

	const stopDomWatcher = startDomWatcher({
		enabled: env.notifyOnAgentIdle,
		pollMs: env.pollMs,
		getCdpUrl: () => env.cdpUrl,
		log,
		minStableIdleSamples,
		domTrace: env.domTrace,
		domHeartbeatMs: env.domHeartbeatMs,
		onEvent: (event) => {
			if (event.type === "taskStarted") {
				const s = event.snapshot;
				log(
					`[taskFinish] taskStarted (agent looks running) seenAt=${s.seenAt} phase=${s.phase} hasStop=${s.hasStop} hasMic=${s.hasMic} hasSend=${s.hasSend}`,
				);
				return;
			}

			if (event.type !== "taskFinished") {
				return;
			}

			const s = event.snapshot;
			const iso = new Date().toISOString();
			log(
				`[taskFinish] taskFinished event at=${iso} seenAt=${s.seenAt} phase=${s.phase} hasStop=${s.hasStop} hasMic=${s.hasMic} hasSend=${s.hasSend} minStableIdleSamples=${minStableIdleSamples}`,
			);

			const now = Date.now();
			const elapsedSinceLastPush = now - lastTaskFinishPushAt;
			if (elapsedSinceLastPush < env.taskFinishCooldownMs) {
				log(
					`[taskFinish] push suppressed: cooldown elapsedMs=${elapsedSinceLastPush} need>=${env.taskFinishCooldownMs}ms (set CURSOR_REMOTE_TASK_FINISH_COOLDOWN_MS to change)`,
				);
				return;
			}

			const deviceCount = getContext().server.listDevices().length;
			log(
				`[taskFinish] proceeding: pairedDevices=${deviceCount} cdpUrl=${env.cdpUrl} pollMs=${env.pollMs}`,
			);

			if (deviceCount === 0) {
				log(
					"[taskFinish] no paired devices — push will no-op (pair the iOS app first)",
				);
			}

			lastTaskFinishPushAt = now;
			void notifyTaskFinished(getContext())
				.then((result) => {
					log(
						`[taskFinish] notifyTaskFinished done sent=${result.sent} failed=${result.failed}`,
					);
				})
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					log(`[taskFinish] notifyTaskFinished error: ${msg}`);
				});
		},
	});

	attachKeyboardHandlers({
		getContext,
		shutdown,
	});

	async function shutdown(): Promise<void> {
		stopDomWatcher();
		await server.stop();
		log("Service stopped.");
		process.exit(0);
	}
}
