# Cursor Remote Extension

This extension interfaces a standalone Cursor Remote service: it shows pairing QR, runs command actions, and surfaces connection status. Core pairing/CDP/APNs logic lives in `../shared` and executes in `../server`.

## Source layout

| Path                            | Role                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| `src/extension.ts`              | Activation, commands, service process wiring                     |
| `src/services/serviceClient.ts` | HTTP client for service command endpoints                        |
| `src/views/connectionView.ts`   | Sidebar webview (CDP status)                                     |
| `../shared/src/`                | Shared pairing, DOM, CDP, APNs logic used by extension + service |
| `../server/src/`                | Standalone background service + keyboard command runner          |

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

## Two ways to run (same service API)

| Path                | What you do                                                                                                         | Extension role                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Extension-first** | Build `../server`, open this repo as the workspace, enable `cursorRemote.autoStartService` (default).               | Spawns Node on `serviceEntryPath` and talks to `cursorRemote.serviceUrl`. |
| **Server-only**     | `cd shared && npm run build`, then `cd ../server && npm run dev` (or `npm start`). Set `CURSOR_REMOTE_*` as needed. | Not required; use the iOS app against the server URL.                     |

Both paths hit the **same** HTTP surface (`/health`, `/pairing`, `/devices`, command routes). The extension is a thin client; if something is already listening on `serviceUrl`, auto-start is a no-op.

## APNs

APNs signing runs **in the standalone service**, not in the extension. Put the `.p8` where the server expects it (see `../server/README.md`, typically `CURSOR_REMOTE_APNS_KEY_PATH`).

## Pairing & agent idle

- Pairing and push workflow runs in the standalone service (`../server`).
- The extension calls service endpoints for:
  - `showPairingQr`
  - `sendTestPush`
  - `checkCdpConnection`

Do not commit the `.p8` to a public repository (keep it gitignored; copy it in before packaging).
