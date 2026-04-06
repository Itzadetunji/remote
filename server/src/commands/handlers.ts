import path from "node:path";
import {
	APNS_BUNDLE_ID,
	APNS_KEY_ID,
	APNS_TEAM_ID,
	APNS_USE_SANDBOX,
	checkCdpConnection,
	sendApnsPush,
	type PairingServer,
} from "@cursorremote/shared";

type SecretStore = {
	get: (key: string) => Promise<string | undefined>;
	store: (key: string, value: string) => Promise<void>;
};

export type ServerContext = {
	server: PairingServer;
	cdpUrl: string;
	log: (message: string) => void;
	secretStore: SecretStore;
	apnsKeyPath: string;
};

export type SendTestPushResult = {
	sent: number;
	failed: number;
	lines: string[];
};

function buildApnsSettings(apnsKeyPath: string) {
	return {
		teamId: APNS_TEAM_ID,
		keyId: APNS_KEY_ID,
		bundleId: APNS_BUNDLE_ID,
		useSandbox: APNS_USE_SANDBOX,
		authKeyPath: path.resolve(apnsKeyPath),
	};
}

export async function sendTestPush(
	ctx: ServerContext,
	body?: string,
	options?: { silent?: boolean; title?: string; traceTag?: string },
): Promise<SendTestPushResult> {
	const silent = options?.silent ?? false;
	const title = options?.title ?? "Cursor Remote";
	const tag = options?.traceTag ? `[${options.traceTag}] ` : "";
	const lines: string[] = [];
	const devices = ctx.server.listDevices();
	if (devices.length === 0) {
		const msg = "No paired devices available.";
		if (!silent) {
			ctx.log(`${tag}${msg}`);
		}
		lines.push(msg);
		return { sent: 0, failed: 0, lines };
	}

	const settings = buildApnsSettings(ctx.apnsKeyPath);
	let failed = 0;
	for (const device of devices) {
		try {
			const result = await sendApnsPush(
				settings,
				ctx.secretStore,
				device.deviceToken,
				{
					title,
					body:
						body ??
						`Test push from service at ${new Date().toLocaleTimeString()}.`,
				},
			);
			if (!result.ok) {
				failed += 1;
				const line = `Push failed (${device.platform}) ${result.statusCode ?? "?"}: ${result.responseBody ?? ""}`;
				if (!silent) {
					ctx.log(`${tag}${line}`);
				}
				lines.push(line);
			}
		} catch (error) {
			failed += 1;
			const line = `Push error (${device.platform}): ${(error as Error).message}`;
			if (!silent) {
				ctx.log(`${tag}${line}`);
			}
			lines.push(line);
		}
	}

	const sent = devices.length - failed;
	const summary = `Push complete. Sent=${sent}, Failed=${failed}`;
	if (!silent) {
		ctx.log(`${tag}${summary}`);
	}
	lines.push(summary);
	return { sent, failed, lines };
}

export async function checkCdp(
	ctx: ServerContext,
	options?: { silent?: boolean },
): Promise<{
	result: string;
	lines: string[];
}> {
	const silent = options?.silent ?? false;
	const result = await checkCdpConnection(ctx.cdpUrl);
	const line = `CDP connected: ${result}`;
	if (!silent) {
		ctx.log(line);
	}
	return { result, lines: [line] };
}

/** Push to all paired devices when the agent task is considered finished (DOM heuristic). */
export async function notifyTaskFinished(
	ctx: ServerContext,
	options?: { silent?: boolean },
): Promise<SendTestPushResult> {
	const devices = ctx.server.listDevices();
	if (!options?.silent) {
		ctx.log(
			`[taskFinish] APNs: title="Task finished" recipients=${devices.length}`,
		);
	}
	const body = `The Cursor agent finished its current task (${new Date().toLocaleString()}).`;
	return sendTestPush(ctx, body, {
		silent: options?.silent,
		title: "Task finished",
		traceTag: "taskFinish",
	});
}
