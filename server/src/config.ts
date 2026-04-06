import path from "node:path";
import { randomBytes } from "node:crypto";

export type ServerEnvConfig = {
	host: string;
	port: number;
	cdpUrl: string;
	apnsKeyPath: string;
	notifyOnAgentIdle: boolean;
	pollMs: number;
	pairingToken: string;
};

export function loadEnvConfig(): ServerEnvConfig {
	return {
		host: process.env.CURSOR_REMOTE_HOST ?? "0.0.0.0",
		port: Number(process.env.CURSOR_REMOTE_PORT ?? "31337"),
		cdpUrl: process.env.CURSOR_REMOTE_CDP_URL ?? "http://127.0.0.1:9222",
		apnsKeyPath:
			process.env.CURSOR_REMOTE_APNS_KEY_PATH ??
			path.resolve(process.cwd(), "../server/AuthKey_55LHUBZN69.p8"),
		notifyOnAgentIdle:
			process.env.CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE !== "false",
		pollMs: Number(process.env.CURSOR_REMOTE_AGENT_IDLE_POLL_MS ?? "8000"),
		pairingToken:
			process.env.CURSOR_REMOTE_PAIRING_TOKEN ??
			randomBytes(24).toString("hex"),
	};
}
