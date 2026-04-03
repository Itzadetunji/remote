import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { PairingServer } from "./server";
import { checkCdpConnection } from "./cdp";
import { getBuiltInApnsSettings, sendApnsPush } from "./apns";

const PAIRING_TOKEN_SECRET = "cursorRemote.pairingToken";

type ExtensionState = {
  server?: PairingServer;
};

const state: ExtensionState = {};

async function getOrCreatePairingToken(secrets: vscode.SecretStorage): Promise<string> {
  const existingToken = await secrets.get(PAIRING_TOKEN_SECRET);
  if (existingToken) {
    return existingToken;
  }

  const token = randomBytes(24).toString("hex");
  await secrets.store(PAIRING_TOKEN_SECRET, token);
  return token;
}

async function ensureServer(context: vscode.ExtensionContext, output: vscode.OutputChannel): Promise<PairingServer> {
  if (state.server) {
    return state.server;
  }

  const config = vscode.workspace.getConfiguration("cursorRemote");
  const host = config.get<string>("serverHost", "0.0.0.0");
  const port = config.get<number>("serverPort", 31337);
  const pairingToken = await getOrCreatePairingToken(context.secrets);

  const server = new PairingServer({
    host,
    port,
    pairingToken
  });
  await server.start();
  state.server = server;
  output.appendLine(`[Cursor Remote] Server started on ${server.getBaseUrl()}`);
  return server;
}

async function stopServer(output: vscode.OutputChannel): Promise<void> {
  if (!state.server) {
    return;
  }
  await state.server.stop();
  output.appendLine("[Cursor Remote] Server stopped");
  state.server = undefined;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel("Cursor Remote");
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorRemote.startServer", async () => {
      try {
        const server = await ensureServer(context, output);
        void vscode.window.showInformationMessage(`Cursor Remote server started on ${server.getBaseUrl()}`);
      } catch (error) {
        void vscode.window.showErrorMessage(`Failed to start server: ${(error as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorRemote.stopServer", async () => {
      try {
        await stopServer(output);
        void vscode.window.showInformationMessage("Cursor Remote server stopped.");
      } catch (error) {
        void vscode.window.showErrorMessage(`Failed to stop server: ${(error as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorRemote.showPairingQr", async () => {
      try {
        const server = await ensureServer(context, output);
        const pairingPayload = server.getPairingPayload();
        const qrDataUrl = await QRCode.toDataURL(pairingPayload, { margin: 1, width: 280 });
        const panel = vscode.window.createWebviewPanel(
          "cursorRemotePairingQr",
          "Cursor Remote Pairing",
          vscode.ViewColumn.Active,
          {}
        );

        panel.webview.html = `
          <!doctype html>
          <html lang="en">
            <body style="font-family: sans-serif; padding: 16px;">
              <h2>Cursor Remote Pairing</h2>
              <p>Scan with your iOS app.</p>
              <img src="${qrDataUrl}" alt="Pairing QR code" />
              <p><strong>Payload:</strong> ${pairingPayload}</p>
              <p><strong>Server:</strong> ${server.getBaseUrl()}</p>
            </body>
          </html>
        `;
      } catch (error) {
        void vscode.window.showErrorMessage(`Unable to show pairing QR: ${(error as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorRemote.sendTestPush", async () => {
      try {
        const server = await ensureServer(context, output);
        const devices = server.listDevices();
        if (devices.length === 0) {
          void vscode.window.showWarningMessage("No paired devices found. Scan the pairing QR in the iOS app first.");
          return;
        }

        const apnsSettings = getBuiltInApnsSettings(context.extensionPath);
        const sends = await Promise.all(
          devices.map(async (device) => {
            const result = await sendApnsPush(
              apnsSettings,
              context.secrets,
              device.deviceToken,
              {
                title: "Cursor Remote",
                body: `Test push from Cursor at ${new Date().toLocaleTimeString()}.`
              }
            );
            return { token: device.deviceToken, result };
          })
        );

        const failed = sends.filter((send) => !send.result.ok);
        if (failed.length === 0) {
          void vscode.window.showInformationMessage(`Push sent to ${sends.length} paired device(s).`);
          return;
        }

        output.appendLine(`[Cursor Remote] Push failures: ${JSON.stringify(failed, null, 2)}`);
        void vscode.window.showWarningMessage(
          `Push sent with ${failed.length} failure(s). See "Cursor Remote" output for details.`
        );
      } catch (error) {
        void vscode.window.showErrorMessage(`Failed to send push: ${(error as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorRemote.checkCdpConnection", async () => {
      const config = vscode.workspace.getConfiguration("cursorRemote");
      const cdpUrl = config.get<string>("cdpUrl", "http://127.0.0.1:9222");
      try {
        const product = await checkCdpConnection(cdpUrl);
        void vscode.window.showInformationMessage(`CDP connected: ${product}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        output.appendLine(`[Cursor Remote] CDP check failed: ${detail}`);
        void vscode.window.showErrorMessage(
          `Could not reach CDP at ${cdpUrl} (${detail}). Try http://127.0.0.1:9222/json/version in a browser, and launch Cursor with --remote-debugging-port=9222.`
        );
      }
    })
  );

  context.subscriptions.push({
    dispose: () => {
      void stopServer(output);
    }
  });

  await ensureServer(context, output);
}

export function deactivate(): void {
  if (state.server) {
    void state.server.stop();
    state.server = undefined;
  }
}
