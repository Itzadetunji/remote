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
	/** Min ms between consecutive "task finished" pushes (dedupe noisy DOM flaps). */
	taskFinishCooldownMs: number;
	/** Log every DOM poll (verbose). */
	domTrace: boolean;
	/** Ms between heartbeat lines when domTrace is off (0 = heartbeats off). */
	domHeartbeatMs: number;
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
		pollMs: Number(process.env.CURSOR_REMOTE_AGENT_IDLE_POLL_MS ?? "500"),
		pairingToken:
			process.env.CURSOR_REMOTE_PAIRING_TOKEN ??
			randomBytes(24).toString("hex"),
		taskFinishCooldownMs: (() => {
			const n = Number(
				process.env.CURSOR_REMOTE_TASK_FINISH_COOLDOWN_MS ?? "6000",
			);
			return Number.isFinite(n) && n >= 0 ? n : 6000;
		})(),
		domTrace: process.env.CURSOR_REMOTE_DOM_TRACE === "true",
		domHeartbeatMs: (() => {
			const n = Number(process.env.CURSOR_REMOTE_DOM_HEARTBEAT_MS ?? "20000");
			return Number.isFinite(n) && n >= 0 ? n : 20_000;
		})(),
	};
}
