# Cursor Remote Extension

This extension starts a local pairing server, shows a QR code for the iOS app, stores pairing/APNs secrets, checks Cursor CDP connectivity, and sends APNs notifications to paired devices.

## Source layout

| Path | Role |
|------|------|
| `src/extension.ts` | Activation, commands, wiring |
| `src/services/pairingServer.ts` | HTTP pairing API + device registry |
| `src/services/pushService.ts` | Broadcast APNs to paired devices |
| `src/apns/` | APNs JWT + built-in defaults |
| `src/cdp/` | CDP health check, agent idle probe + watcher |
| `src/views/connectionView.ts` | Sidebar webview (CDP status) |

## Development

```bash
cd extension
npm install
npm run compile
```

## Cursor CDP

Launch Cursor with Chrome DevTools Protocol enabled:

```bash
open -a Cursor --args --remote-debugging-port=9222
```

Then run `Cursor Remote: Check CDP Connection` to verify the extension can reach CDP.

## APNs (built-in)

Team ID, Key ID, bundle ID, and sandbox flag are set in `src/apns/apnsDefaults.ts`. The APNs auth key file must be named `AuthKey_55LHUBZN69.p8` and sit in the **extension root** (next to `package.json`) so it is bundled when you build a `.vsix`. The key PEM is cached in VS Code `SecretStorage` after the first successful read.

## Pairing & agent idle

- When a **new** device registers, the extension shows a VS Code notification and sends an APNs alert to **all** paired devices.
- **Agent task finished** (optional): with CDP enabled, the extension polls the workbench and sends a push when the UI goes from “busy” to “idle” (see `src/cdp/agentProbeExpression.ts` — heuristic, may need updates as Cursor’s UI changes). Settings: `cursorRemote.notifyOnAgentIdle`, `cursorRemote.agentIdlePollMs`.

Do not commit the `.p8` to a public repository (keep it gitignored; copy it in before packaging).
