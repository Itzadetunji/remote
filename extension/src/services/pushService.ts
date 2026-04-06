import type { ExtensionContext, OutputChannel } from "vscode";
import { getBuiltInApnsSettings, sendApnsPush } from "../apns/apns";
import type { PairingServer } from "./pairingServer";

export async function notifyAllPairedDevices(
	context: ExtensionContext,
	server: PairingServer,
	output: OutputChannel,
	message: { title: string; body: string },
): Promise<void> {
	const devices = server.listDevices();
	if (devices.length === 0) {
		return;
	}

	const settings = getBuiltInApnsSettings(context.extensionPath);
	for (const device of devices) {
		try {
			const result = await sendApnsPush(settings, context.secrets, device.deviceToken, message);
			if (!result.ok) {
				output.appendLine(`[Cursor Remote] APNs push failed (${device.platform}): ${result.statusCode} ${result.responseBody ?? ""}`);
			}
		} catch (error) {
			output.appendLine(`[Cursor Remote] APNs push error (${device.platform}): ${(error as Error).message}`);
		}
	}
}
