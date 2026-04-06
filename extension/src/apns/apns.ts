import { SignJWT, importPKCS8 } from "jose";
import { connect, type IncomingHttpHeaders } from "node:http2";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	APNS_AUTH_KEY_FILENAME,
	APNS_BUNDLE_ID,
	APNS_KEY_ID,
	APNS_TEAM_ID,
	APNS_USE_SANDBOX,
} from "./apnsDefaults";

export interface ApnsSettings {
	teamId: string;
	keyId: string;
	bundleId: string;
	useSandbox: boolean;
	/** Resolved absolute path to the .p8 file (set by getBuiltInApnsSettings). */
	authKeyPath: string;
}

export function getBuiltInApnsSettings(extensionPath: string): ApnsSettings {
	return {
		teamId: APNS_TEAM_ID,
		keyId: APNS_KEY_ID,
		bundleId: APNS_BUNDLE_ID,
		useSandbox: APNS_USE_SANDBOX,
		authKeyPath: path.join(extensionPath, APNS_AUTH_KEY_FILENAME),
	};
}

interface PushPayloadInput {
	title: string;
	body: string;
}

export interface PushResult {
	ok: boolean;
	statusCode?: number;
	responseBody?: string;
}

async function loadApnsPrivateKey(
	settings: ApnsSettings,
	secrets: {
		get(key: string): Thenable<string | undefined>;
		store(key: string, value: string): Thenable<void>;
	},
): Promise<string> {
	const secretKeyName = "cursorRemote.apns.authKey";
	const fromSecret = await secrets.get(secretKeyName);
	if (fromSecret) {
		return fromSecret;
	}

	const keyContents = await readFile(settings.authKeyPath, "utf8");
	await secrets.store(secretKeyName, keyContents);
	return keyContents;
}

async function buildJwtToken(
	settings: ApnsSettings,
	privateKeyPem: string,
): Promise<string> {
	const privateKey = await importPKCS8(privateKeyPem, "ES256");
	const nowSeconds = Math.floor(Date.now() / 1000);
	return new SignJWT({})
		.setProtectedHeader({ alg: "ES256", kid: settings.keyId })
		.setIssuer(settings.teamId)
		.setIssuedAt(nowSeconds)
		.sign(privateKey);
}

export async function sendApnsPush(
	settings: ApnsSettings,
	secrets: {
		get(key: string): Thenable<string | undefined>;
		store(key: string, value: string): Thenable<void>;
	},
	deviceToken: string,
	message: PushPayloadInput,
): Promise<PushResult> {
	const privateKey = await loadApnsPrivateKey(settings, secrets);
	const jwt = await buildJwtToken(settings, privateKey);
	const authority = settings.useSandbox
		? "api.development.push.apple.com"
		: "api.push.apple.com";
	const authorityUrl = `https://${authority}`;
	const payload = JSON.stringify({
		aps: {
			alert: {
				title: message.title,
				body: message.body,
			},
			sound: "default",
		},
	});

	return await new Promise<PushResult>((resolve, reject) => {
		const session = connect(authorityUrl);
		const req = session.request({
			":method": "POST",
			":path": `/3/device/${deviceToken}`,
			authorization: `bearer ${jwt}`,
			"apns-topic": settings.bundleId,
			"apns-push-type": "alert",
			"content-type": "application/json",
			"content-length": Buffer.byteLength(payload),
		});

		let responseBody = "";
		req.setEncoding("utf8");
		req.on("response", (headers: IncomingHttpHeaders) => {
			const statusCode = Number(headers[":status"] ?? 0);
			req.on("data", (chunk: string) => {
				responseBody += chunk;
			});
			req.on("end", () => {
				session.close();
				resolve({
					ok: statusCode >= 200 && statusCode < 300,
					statusCode,
					responseBody,
				});
			});
		});
		req.on("error", (error) => {
			session.close();
			reject(error);
		});
		req.write(payload);
		req.end();
	});
}
