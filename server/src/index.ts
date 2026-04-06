import readline from "node:readline";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { PairingServer, startDomWatcher } from "@cursorremote/shared";
import {
	checkCdp,
	sendTestPush,
	showHelp,
	showPairingPayload,
	type ServerContext,
} from "./commandHandlers";

const host = process.env.CURSOR_REMOTE_HOST ?? "0.0.0.0";
const port = Number(process.env.CURSOR_REMOTE_PORT ?? "31337");
const cdpUrl = process.env.CURSOR_REMOTE_CDP_URL ?? "http://127.0.0.1:9222";
const apnsKeyPath =
	process.env.CURSOR_REMOTE_APNS_KEY_PATH ??
	path.resolve(process.cwd(), "../server/AuthKey_55LHUBZN69.p8");
const notifyOnAgentIdle =
	process.env.CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE !== "false";
const pollMs = Number(process.env.CURSOR_REMOTE_AGENT_IDLE_POLL_MS ?? "8000");
const pairingToken =
	process.env.CURSOR_REMOTE_PAIRING_TOKEN ?? randomBytes(24).toString("hex");

const runtimeSecrets = new Map<string, string>();
const secretStore = {
	get: async (key: string): Promise<string | undefined> =>
		runtimeSecrets.get(key),
	store: async (key: string, value: string): Promise<void> => {
		runtimeSecrets.set(key, value);
	},
};

function log(message: string): void {
	// Keep log format simple for terminal users.
	// eslint-disable-next-line no-console
	console.log(`[cursor-remote-service] ${message}`);
}

async function main(): Promise<void> {
	let context!: ServerContext;

	const server = new PairingServer({
		host,
		port,
		pairingToken,
		onDeviceRegistered: (device) => {
			log(
				`Device paired: ${device.platform} (${device.deviceToken.slice(0, 8)}...)`,
			);
			void sendTestPush(context, `Device paired: ${device.platform}`);
		},
		registerRoutes: (app, svc) => {
			app.get("/pairing", (_req: Request, res: Response) => {
				res.json({
					payload: svc.getPairingPayload(),
					baseUrl: svc.getBaseUrl(),
					devices: svc.listDevices().length,
				});
			});

			app.post("/commands/check-cdp", async (_req: Request, res: Response) => {
				try {
					const result = await checkCdp(context);
					res.json({ ok: true, result });
				} catch (error) {
					res.status(500).json({ ok: false, error: (error as Error).message });
				}
			});

			app.post(
				"/commands/send-test-push",
				async (req: Request, res: Response) => {
					try {
						const body =
							typeof req.body?.body === "string" ? req.body.body : undefined;
						const result = await sendTestPush(context, body);
						res.json({ ok: true, ...result });
					} catch (error) {
						res
							.status(500)
							.json({ ok: false, error: (error as Error).message });
					}
				},
			);
		},
	});

	context = {
		server,
		cdpUrl,
		log,
		secretStore,
		apnsKeyPath,
	};

	await server.start();
	log(`Service started at ${server.getBaseUrl()}`);
	log(`Pairing payload: ${server.getPairingPayload()}`);
	showHelp(log);

	const stopDomWatcher = startDomWatcher({
		enabled: notifyOnAgentIdle,
		pollMs,
		getCdpUrl: () => cdpUrl,
		log,
		minStableIdleSamples: 2,
		onEvent: (event) => {
			if (event.type === "taskFinished") {
				log("Detected taskFinished transition; sending push.");
				void sendTestPush(context, "Agent task finished in Cursor.");
			}
		},
	});

	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(true);
	}

	process.stdin.on("keypress", (_str, key) => {
		if (key.ctrl && key.name === "c") {
			void shutdown();
			return;
		}

		switch (key.name) {
			case "h":
				showHelp(log);
				break;
			case "c":
				void checkCdp(context).catch((error) =>
					log(`CDP check failed: ${(error as Error).message}`),
				);
				break;
			case "q":
				showPairingPayload(context);
				break;
			case "p":
				void sendTestPush(context).catch((error) =>
					log(`Push command failed: ${(error as Error).message}`),
				);
				break;
			case "x":
				void shutdown();
				break;
			default:
				break;
		}
	});

	async function shutdown(): Promise<void> {
		stopDomWatcher();
		await server.stop();
		log("Service stopped.");
		process.exit(0);
	}
}

void main().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error);
	process.exit(1);
});
