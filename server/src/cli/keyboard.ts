import readline from "node:readline";
import pc from "picocolors";
import type { ServerContext } from "../commands/handlers";
import { checkCdp, sendTestPush } from "../commands/handlers";
import {
	printHelp,
	printPairingBlock,
	printResponseLines,
	runCommandBlock,
} from "./ui";

export type KeyboardDeps = {
	getContext: () => ServerContext;
	shutdown: () => Promise<void>;
};

export function attachKeyboardHandlers(deps: KeyboardDeps): void {
	const { getContext, shutdown } = deps;

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
				void runCommandBlock("Help", async () => {
					console.log(pc.bold(pc.white("Response")));
					console.log("");
					printHelp();
				});
				break;
			case "c":
				void runCommandBlock("Check CDP", async () => {
					const { lines } = await checkCdp(getContext(), { silent: true });
					printResponseLines(lines);
				});
				break;
			case "q":
				void runCommandBlock("Pairing (URL & QR)", async () => {
					await printPairingBlock(getContext().server);
				});
				break;
			case "p":
				void runCommandBlock("Send test push", async () => {
					const { lines } = await sendTestPush(getContext(), undefined, {
						silent: true,
					});
					printResponseLines(lines);
				});
				break;
			case "x":
				void shutdown();
				break;
			default:
				break;
		}
	});
}
