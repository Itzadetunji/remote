# Cursor Remote Service

Standalone background service for Cursor Remote. The extension can interface this service, while core logic is shared from `../shared`.

## Run

```bash
cd shared && npm install && npm run build
cd ../server && npm install && npm run dev
```

## Environment

- `CURSOR_REMOTE_HOST` (default: `0.0.0.0`)
- `CURSOR_REMOTE_PORT` (default: `31337`)
- `CURSOR_REMOTE_CDP_URL` (default: `http://127.0.0.1:9222`) — used by the DOM watcher and by **iOS chat → agent inject**: the service discovers the **workbench** page via `GET /json`, opens that target’s **WebSocket** CDP session (same approach as len-cursor), focuses the chat input with multiple selector fallbacks, clears with Ctrl+A / Backspace, inserts text with **`Input.insertText`**, and submits with **Enter**. Launch Cursor with remote debugging (e.g. `open -a Cursor --args --remote-debugging-port=9222`) and keep the agent sidebar open; failures appear in logs as `agent:inject failed`.
- `CURSOR_REMOTE_APNS_KEY_PATH` (default: `../server/AuthKey_55LHUBZN69.p8`)
- `CURSOR_REMOTE_NOTIFY_ON_AGENT_IDLE` (default: `true`)
- `CURSOR_REMOTE_AGENT_IDLE_POLL_MS` (default: `500`)
- `CURSOR_REMOTE_PAIRING_TOKEN` (optional, auto-generated if omitted)

## Keyboard Commands

- `h` help
- `c` check CDP
- `q` print pairing payload
- `p` send test push
- `x` stop service

## HTTP Endpoints

- `GET /health`
- `GET /pairing`
- `POST /devices` (pairing)
- `POST /commands/check-cdp`
- `POST /commands/send-test-push`
