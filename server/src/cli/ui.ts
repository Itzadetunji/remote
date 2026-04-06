import pc from "picocolors";
import QRCode from "qrcode";
import type { PairingServer } from "@cursorremote/shared";

const SEP = pc.dim("─".repeat(56));

export async function printStartupBanner(server: PairingServer): Promise<void> {
	const baseUrl = server.getBaseUrl();
	const payload = server.getPairingPayload();
	const localhostUrl = `http://127.0.0.1:${server.getPort()}`;

	console.log("");
	console.log(pc.bold(pc.cyan("Cursor Remote")));
	console.log(SEP);
	console.log(
		pc.bold("Connection URL") + pc.dim("  (scan QR or enter in the app)"),
	);
	console.log(pc.green(baseUrl));
	if (baseUrl !== localhostUrl) {
		console.log(pc.dim("Local loopback: ") + pc.green(localhostUrl));
	}
	console.log("");
	console.log(pc.bold("Pairing QR"));
	let qr: string;
	try {
		qr = await QRCode.toString(payload, { type: "terminal", small: true });
	} catch {
		qr = pc.dim("(could not render QR in this terminal)");
	}
	console.log(qr);
	console.log("");
	console.log(pc.dim("Payload: ") + pc.yellow(payload));
	console.log(SEP);
	console.log("");
}

export function printHelp(): void {
	console.log(pc.bold("Keyboard commands"));
	console.log(`  ${pc.magenta("h")}  ${pc.dim("—")}  show this help`);
	console.log(`  ${pc.magenta("c")}  ${pc.dim("—")}  check CDP connection`);
	console.log(`  ${pc.magenta("q")}  ${pc.dim("—")}  show pairing URL & QR again`);
	console.log(`  ${pc.magenta("p")}  ${pc.dim("—")}  send test push`);
	console.log(`  ${pc.magenta("x")}  ${pc.dim("—")}  exit service`);
	console.log(`  ${pc.dim("Ctrl+C")}  ${pc.dim("—")}  exit`);
	console.log("");
}

export function logService(message: string): void {
	console.log(pc.dim(`[cursor-remote] ${message}`));
}

/**
 * Blank line, separator, command label, then runs the action (caller prints response).
 */
export async function runCommandBlock(
	title: string,
	action: () => Promise<void>,
): Promise<void> {
	console.log("\n");
	console.log(SEP);
	console.log(pc.bold(pc.green("▶ ")) + pc.bold(title));
	console.log("");
	await action();
}

export function printResponseLines(lines: string[]): void {
	console.log(pc.bold(pc.white("Response")));
	for (const line of lines) {
		console.log(pc.white(line));
	}
}

export async function printPairingBlock(server: PairingServer): Promise<void> {
	console.log(pc.bold(pc.white("Response")));
	console.log("");
	const baseUrl = server.getBaseUrl();
	const payload = server.getPairingPayload();
	console.log(pc.bold("Base URL"));
	console.log(pc.green(baseUrl));
	console.log("");
	console.log(pc.bold("Pairing QR"));
	try {
		const qr = await QRCode.toString(payload, {
			type: "terminal",
			small: true,
		});
		console.log(qr);
	} catch {
		console.log(pc.dim("(QR unavailable)"));
	}
	console.log("");
	console.log(pc.dim("Payload: ") + pc.yellow(payload));
}
