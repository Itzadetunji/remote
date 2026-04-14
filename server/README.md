# Cursor Remote Service (`cursor-remote-service`)

Standalone **Node.js** process that:

1. Serves **HTTP** (pairing, health, optional command routes).
2. Mounts **Socket.IO** on the **same TCP port** for authenticated iOS realtime (chat inject + streamed assistant replies).
3. Optionally drives **Cursor** via **CDP** (inject text, poll transcript) and runs a **DOM watcher** for agent-idle detection and APNs.

It depends on **`@cursorremote/shared`** (`file:../shared`). Build **`shared`** first.

---

## Run

```bash
cd ../shared && npm install && npm run build
cd ../server && npm install && npm run dev
```

- **`npm run dev`**: `tsc` then `node dist/index.js`.
- **`npm start`**: run compiled output only (build first).

Equivalent with **Bun**: `bun install` / `bun run build` in `shared`, then `server`.

---

## Configuration (environment variables)

Loaded in **`src/config.ts`**. Defaults are safe for local dev.

| Variable | Default | Meaning |
|----------|---------|---------|
| **`CURSOR_REMOTE_HOST`** | `0.0.0.0` | Bind address (`0.0.0.0` = all interfaces; phone uses Mac’s LAN IP). |
| **`CURSOR_REMOTE_PORT`** | `31337` | HTTP + Socket.IO port. |
| **`CURSOR_REMOTE_PAIRING_TOKEN`** | *(random on each start if unset)* | Bearer token for **`POST /devices`** and embedded in QR payload. **Set explicitly** if you need stable pairing across restarts. |
| **`CURSOR_REMOTE_CDP_URL`** | `http://127.0.0.1:9222` | Chrome DevTools **HTTP** endpoint (same host/port you pass to Cursor as `--remote-debugging-port`). Used for DOM watcher and **iOS chat → agent** (workbench page + WebSocket CDP). |
| **`CURSOR_REMOTE_APNS_KEY_PATH`** | *(see config)* | Path to APNs **`.p8`** auth key. |
| **`CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE`** | `true` | Enable DOM-based “task finished” heuristics and pushes. Set to `false` to disable. |
| **`CURSOR_REMOTE_AGENT_IDLE_POLL_MS`** | `500` | Poll interval for DOM watcher (ms). |
| **`CURSOR_REMOTE_TASK_FINISH_COOLDOWN_MS`** | `6000` | Min time between task-finish pushes **per tab scope**. |
| **`CURSOR_REMOTE_DOM_TRACE`** | `false` | Verbose DOM poll logging. |
| **`CURSOR_REMOTE_DOM_HEARTBEAT_MS`** | `20000` | Heartbeat log interval when `DOM_TRACE` is off. |

**Cursor** must be launched with remote debugging for CDP features, e.g.:

```bash
open -a Cursor --args --remote-debugging-port=9222
```

---

## What the service does with CDP (technical)

- **iOS chat**: After Socket.IO auth, `message:send` triggers a **WebSocket CDP** session to the **workbench** renderer (discovered via `GET {cdpUrl}/json`). The client types into the agent composer (`Input.insertText`, Enter) and **polls** the last assistant message in the DOM; chunks are sent to the phone as **`message:receive`** with a **`done`** flag. See **`shared`** README for DOM assumptions.
- **DOM watcher**: Separate CDP probes (see `shared` `domWatcher`) for agent-idle signals; independent from chat streaming.

If CDP is down or selectors break, check logs for **`agent:stream error`** or probe failures—**not** necessarily HTTP 5xx.

---

## HTTP API (surface)

| Method | Path | Purpose |
|--------|------|---------|
| **GET** | `/health` | Liveness + device count. |
| **GET** | `/pairing` | JSON: pairing payload string, base URL, device count (for QR UIs). |
| **POST** | `/devices` | **Register device**: `Authorization: Bearer <pairing token>`, JSON `{ deviceToken, platform }`. Required before Socket.IO `auth:request` succeeds. |
| **POST** | `/devices/disconnect` | **Unregister** by `deviceToken` (JSON body). Used when the phone disconnects. |
| **POST** | `/commands/check-cdp` | Verify CDP HTTP reachability (registered in `http/routes.ts`). |
| **POST** | `/commands/send-test-push` | Send a test push to registered devices. |

Socket.IO is on the **same origin** as HTTP (same port). Clients connect to `http://<host>:<port>`; the engine handles `/socket.io/`.

---

## Interactive keyboard (TTY)

When stdin is a TTY, the service attaches **keyboard shortcuts** (see `src/cli/keyboard.ts`):

| Key | Action |
|-----|--------|
| **h** | Help |
| **c** | Check CDP |
| **q** | Print pairing payload / QR block |
| **p** | Send test push |
| **x** | Exit (Ctrl+C also stops) |

---

## Relationship to the VS Code extension

The **extension** can spawn this binary or assume it is already listening on `cursorRemote.serviceUrl`. Same HTTP API either way—see **`../extension/README.md`**.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Phone cannot pair | Firewall, same Wi‑Fi, correct **LAN IP** in QR (`PairingServer` uses host `0.0.0.0` but advertises LAN IP in payload). |
| Socket connects but auth fails | Device must be registered with **`POST /devices`** first; pairing token must match. |
| No agent inject / stream | **`CURSOR_REMOTE_CDP_URL`**, Cursor launched with **`--remote-debugging-port`**, agent panel visible; see **`shared`** README for DOM fragility. |
| No pushes | **`CURSOR_REMOTE_APNS_KEY_PATH`**, bundle ID, sandbox vs production, device token registered. |

---

## See also

- **[../shared/README.md](../shared/README.md)** — internals of pairing, Socket.IO, CDP modules.
- **[../README.md](../README.md)** — repository overview and iOS quick start.
