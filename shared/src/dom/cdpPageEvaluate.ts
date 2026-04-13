import { URL } from "node:url";

type CdpClient = {
	Runtime: {
		enable: () => Promise<void>;
		evaluate: (params: {
			expression: string;
			returnByValue: boolean;
			awaitPromise: boolean;
		}) => Promise<{ result?: { value?: unknown } }>;
	};
	close: () => Promise<void>;
};

/** CommonJS export: callable connect + `.List` (no `.default`). */
type ChromeRemoteInterface = ((
	options: { host: string; port: number; target: string },
) => Promise<CdpClient>) & {
	List: (options: {
		host: string;
		port: number;
		secure: boolean;
	}) => Promise<Array<{ id: string; type: string }>>;
};

function parseCdpUrl(cdpUrl: string): {
	host: string;
	port: number;
	secure: boolean;
} {
	const parsed = new URL(cdpUrl);
	return {
		host: parsed.hostname,
		port: Number(
			parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
		),
		secure: parsed.protocol === "https:",
	};
}

export type CursorPageEvaluateFailureReason =
	| "no_targets"
	| "no_page_target"
	| "cdp_error";

export type CursorPageEvaluateResult =
	| { ok: true; value: unknown; targetId: string }
	| {
			ok: false;
			reason: CursorPageEvaluateFailureReason;
			detail?: string;
	  };

/**
 * Runs `Runtime.evaluate` on the first CDP page target (same selection as the DOM probe).
 */
export async function evaluateOnCursorPage(
	cdpUrl: string,
	expression: string,
): Promise<CursorPageEvaluateResult> {
	const parsed = parseCdpUrl(cdpUrl);
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const CDP = require("chrome-remote-interface") as ChromeRemoteInterface;
	try {
		const targets = (await CDP.List(parsed)) as Array<{
			id: string;
			type: string;
			url?: string;
		}>;
		if (!targets.length) {
			return { ok: false, reason: "no_targets" };
		}
		// Prefer the workbench renderer (len-cursor CDPBridge), not an arbitrary page.
		const target =
			targets.find(
				(item) =>
					item.type === "page" && item.url?.includes("workbench"),
			) ??
			targets.find((item) => item.type === "page") ??
			targets[0];
		if (!target) {
			return { ok: false, reason: "no_page_target" };
		}

		const client = await CDP({
			host: parsed.host,
			port: parsed.port,
			target: target.id,
		});

		try {
			await client.Runtime.enable();
			const evaluated = await client.Runtime.evaluate({
				expression,
				returnByValue: true,
				awaitPromise: false,
			});
			return {
				ok: true,
				value: evaluated.result?.value,
				targetId: target.id,
			};
		} finally {
			await client.close();
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		return { ok: false, reason: "cdp_error", detail: msg };
	}
}
