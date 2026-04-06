import { PairingServer, startDomWatcher } from "@cursorremote/shared";
import { sendTestPush, type ServerContext } from "./commands/handlers";
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

	const stopDomWatcher = startDomWatcher({
		enabled: env.notifyOnAgentIdle,
		pollMs: env.pollMs,
		getCdpUrl: () => env.cdpUrl,
		log,
		minStableIdleSamples: 2,
		onEvent: (event) => {
			if (event.type === "taskFinished") {
				log("Detected taskFinished transition; sending push.");
				void sendTestPush(getContext(), "Agent task finished in Cursor.");
			}
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
