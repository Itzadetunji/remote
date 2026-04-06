/**
 * Verifies CDP is reachable using GET /json/version (same data Chrome shows; works when a "page" target would not expose Browser.* over WebSocket).
 */
export async function checkCdpConnection(cdpUrl: string): Promise<string> {
	const base = cdpUrl.replace(/\/$/, "");
	const versionUrl = `${base}/json/version`;
	const response = await fetch(versionUrl);
	if (!response.ok) {
		throw new Error(`GET ${versionUrl} → HTTP ${response.status}`);
	}
	const data = (await response.json()) as { Browser?: string; "Protocol-Version"?: string; product?: string };
	const label = data.Browser ?? data.product ?? data["Protocol-Version"] ?? "connected";
	return label;
}
