import path from "node:path";
import {
  APNS_BUNDLE_ID,
  APNS_KEY_ID,
  APNS_TEAM_ID,
  APNS_USE_SANDBOX,
  checkCdpConnection,
  sendApnsPush,
  type PairingServer
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

function buildApnsSettings(apnsKeyPath: string) {
  return {
    teamId: APNS_TEAM_ID,
    keyId: APNS_KEY_ID,
    bundleId: APNS_BUNDLE_ID,
    useSandbox: APNS_USE_SANDBOX,
    authKeyPath: path.resolve(apnsKeyPath)
  };
}

export async function sendTestPush(ctx: ServerContext, body?: string): Promise<{ sent: number; failed: number }> {
  const devices = ctx.server.listDevices();
  if (devices.length === 0) {
    ctx.log("No paired devices available.");
    return { sent: 0, failed: 0 };
  }

  const settings = buildApnsSettings(ctx.apnsKeyPath);
  let failed = 0;
  for (const device of devices) {
    try {
      const result = await sendApnsPush(settings, ctx.secretStore, device.deviceToken, {
        title: "Cursor Remote",
        body: body ?? `Test push from service at ${new Date().toLocaleTimeString()}.`
      });
      if (!result.ok) {
        failed += 1;
        ctx.log(`Push failed (${device.platform}) ${result.statusCode ?? "?"}: ${result.responseBody ?? ""}`);
      }
    } catch (error) {
      failed += 1;
      ctx.log(`Push error (${device.platform}): ${(error as Error).message}`);
    }
  }

  const sent = devices.length - failed;
  ctx.log(`Push complete. Sent=${sent}, Failed=${failed}`);
  return { sent, failed };
}

export async function checkCdp(ctx: ServerContext): Promise<string> {
  const result = await checkCdpConnection(ctx.cdpUrl);
  ctx.log(`CDP connected: ${result}`);
  return result;
}

export function showPairingPayload(ctx: ServerContext): string {
  const payload = ctx.server.getPairingPayload();
  ctx.log(`Pairing payload:\n${payload}`);
  return payload;
}

export function showHelp(log: (message: string) => void): void {
  log("Keyboard shortcuts:");
  log("  h - help");
  log("  c - check CDP");
  log("  q - show pairing payload");
  log("  p - send test push");
  log("  x - exit service");
}
