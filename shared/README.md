# `@cursorremote/shared`

TypeScript library compiled to **`dist/`** and consumed as **`file:../shared`** by **`cursor-remote-service`** (`../server`). It holds **pairing**, **realtime (Socket.IO)** wiring, **CDP/DOM** helpers, and **APNs** utilities—everything that should not be duplicated between the standalone server and future tooling.

---

## Role in the architecture

- **`server`** imports this package and starts **`PairingServer`**, which mounts HTTP routes **and** a **Socket.IO** server on the same HTTP listener.
- The **extension** does not import this package at runtime; it talks to the server over HTTP. The **iOS** app only talks to the server (not to this package directly).

Conceptually:

```
shared (compiled JS) ──► server process ──► HTTP + Socket.IO + CDP
```

---

## Package layout (`src/`)

| Area | Contents |
|------|-----------|
| **`services/pairingServer.ts`** | Express-style **`PairingServer`**: `/health`, `/devices`, `/devices/disconnect`, optional `registerRoutes` hook. **`createSocketServer`** attaches Socket.IO when `start()` runs. |
| **`realtime/`** | **`protocol.ts`**: event names (`message:send`, `message:receive`, auth, …) and payload types. **`socketServer.ts`**: Socket.IO auth + message routing + **agent inject/stream** when `cdpUrl` is set. |
| **`dom/`** | DOM selectors (`selectors.ts`), probe scripts, **`cdpPageEvaluate`** (chrome-remote-interface for probes), **`cdpWebSocketClient`** (raw WebSocket CDP—used for reliable inject against Electron), **`cursorComposerSend`** (focus → `Input.insertText` → Enter), **`assistantReplyStream`** (poll last assistant bubble, stream over Socket.IO). |
| **`cdp/cdp.ts`** | Lightweight **`checkCdpConnection`** (HTTP `GET /json/version`). |
| **`apns/`** | APNs JWT signing and send helpers. |

Exports are re-exported from **`src/index.ts`**—import from `@cursorremote/shared` after `npm run build`.

---

## Build

```bash
npm install
npm run build
```

Output: **`dist/`** with `.js` and `.d.ts`. **`server`** depends on this path via `package.json`; rebuild **`shared`** after changing types or runtime code used by the server.

---

## Dependencies (why they exist)

| Package | Purpose |
|---------|---------|
| **express** | `PairingServer` HTTP app (mounted on Node `http.Server`). |
| **socket.io** | Realtime channel for iOS ↔ Mac (same port as HTTP). |
| **chrome-remote-interface** | CDP over Node for **DOM probe** / `evaluateOnCursorPage` (workbench target selection). |
| **ws** | Direct **WebSocket** to a page target’s `webSocketDebuggerUrl` (avoids some Electron CDP limitations for inject). |
| **jose** | JWT for APNs (if used by apns module). |

---

## Realtime protocol (summary)

Defined in **`src/realtime/protocol.ts`**. High level:

1. Client connects Socket.IO, receives **`connection:state`**.
2. Client emits **`auth:request`** with **`deviceToken`** (hex APNs token); server checks device was registered via **`POST /devices`**.
3. **`message:send`**: `{ text, conversationId }` — server may inject into Cursor (CDP) and stream assistant text via **`message:receive`** (`done` flag for streaming end).

Exact field names must stay aligned with the **iOS** `RealtimeSocketService` if you change the protocol.

---

## Fragility note (CDP / DOM)

Anything under **`dom/`** that queries Cursor’s DOM (class names, `data-*` attributes) can **break** when Cursor ships UI updates. Treat selectors as **versioned assumptions**; failures usually show up as inject/stream errors in server logs, not TypeScript compile errors.

---

## See also

- **[../server/README.md](../server/README.md)** — env vars, how the service loads `shared`, HTTP routes.
- **[../README.md](../README.md)** — repo-wide overview.
