import * as vscode from "vscode";
import { checkCdpConnection } from "./cdp";

/** Restart Cursor with remote debugging (macOS Terminal). Shown when CDP is offline. */
const MAC_RESTART_CDP_SCRIPT = `DEBUG_PORT=9222

pkill -x Cursor 2>/dev/null
sleep 1

open -a Cursor --args --remote-debugging-port=$DEBUG_PORT

exit`;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export class ConnectionStatusViewProvider
	implements vscode.WebviewViewProvider
{
	public static readonly viewId = "cursorRemoteConnectionStatus";

	private view?: vscode.WebviewView;
	private pollTimer: ReturnType<typeof setInterval> | undefined;

	constructor(private readonly context: vscode.ExtensionContext) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		webviewView.webview.html = this.getHtml();

		webviewView.onDidDispose(() => {
			this.stopPolling();
			this.view = undefined;
		});

		void this.runCheck();
		this.startPolling();
	}

	private startPolling(): void {
		this.stopPolling();
		this.pollTimer = setInterval(() => {
			void this.runCheck();
		}, 5000);
	}

	private stopPolling(): void {
		if (this.pollTimer !== undefined) {
			clearInterval(this.pollTimer);
			this.pollTimer = undefined;
		}
	}

	private async runCheck(): Promise<void> {
		const webview = this.view?.webview;
		if (!webview) {
			return;
		}

		const config = vscode.workspace.getConfiguration("cursorRemote");
		const cdpUrl = config.get<string>("cdpUrl", "http://127.0.0.1:9222");

		try {
			const detail = await checkCdpConnection(cdpUrl);
			webview.postMessage({ type: "status", ok: true, detail, cdpUrl });
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			webview.postMessage({ type: "status", ok: false, detail, cdpUrl });
		}
	}

	private getHtml(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --ok: #3fb950;
      --bad: #f85149;
      --muted: var(--vscode-descriptionForeground);
      --fg: var(--vscode-foreground);
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--fg);
      padding: 12px;
      margin: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .tower {
      flex-shrink: 0;
      color: var(--fg);
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
    }
    .label {
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .detail {
      font-size: 11px;
      color: var(--muted);
      margin-top: 8px;
      word-break: break-all;
      line-height: 1.4;
    }
    .offline-help {
      margin-top: 14px;
      padding: 10px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 6px;
      background: var(--vscode-editor-inactiveSelectionBackground);
    }
    .offline-help p {
      margin: 0 0 10px 0;
      line-height: 1.45;
      font-size: 12px;
    }
    .script-wrap {
      position: relative;
    }
    .script-wrap pre {
      margin: 0 0 8px 0;
      padding: 8px 10px;
      font-family: var(--vscode-editor-font-family);
      font-size: 11px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      max-height: 180px;
      overflow: auto;
    }
    .copy-btn {
      font-family: inherit;
      font-size: 12px;
      padding: 6px 12px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .copy-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    svg { display: block; }
  </style>
</head>
<body>
  <div class="label">Chrome DevTools Protocol</div>
  <div class="row">
    <div class="tower" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.5 10.5c1.5-2 4-3.2 7.5-3.2s6 1.2 7.5 3.2" />
        <path d="M6 14c1.2-1.5 3-2.5 6-2.5s4.8 1 6 2.5" />
        <path d="M8 17.5c.8-.8 2-1.3 4-1.3s3.2.5 4 1.3" />
        <line x1="12" y1="21" x2="12" y2="18" />
        <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <div class="status" id="status">
      <span id="indicator"></span>
      <span id="text">Checking…</span>
    </div>
  </div>
  <div class="detail" id="detail"></div>
  <div class="offline-help" id="offlineHelp" style="display:none">
    <p>CDP is not connected. <strong>Save your work</strong>, then run this in <strong>macOS Terminal</strong> (it quits and restarts Cursor with remote debugging):</p>
    <div class="script-wrap">
      <pre id="scriptBlock">${escapeHtml(MAC_RESTART_CDP_SCRIPT)}</pre>
      <button type="button" class="copy-btn" id="copyBtn">Copy command</button>
    </div>
  </div>
  <script>
    (function () {
      const vscode = acquireVsCodeApi();
      const indicator = document.getElementById('indicator');
      const text = document.getElementById('text');
      const detail = document.getElementById('detail');
      const offlineHelp = document.getElementById('offlineHelp');
      const scriptBlock = document.getElementById('scriptBlock');
      const copyBtn = document.getElementById('copyBtn');

      const checkSvg = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#3fb950" opacity="0.2"/><path fill="none" stroke="#3fb950" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 12.5l2.5 2.5L16 9"/></svg>';
      const crossSvg = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#f85149" opacity="0.2"/><path stroke="#f85149" stroke-width="2" stroke-linecap="round" d="M9 9l6 6M15 9l-6 6"/></svg>';

      copyBtn.addEventListener('click', async function () {
        const raw = scriptBlock.textContent || '';
        try {
          await navigator.clipboard.writeText(raw);
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy command'; }, 2000);
        } catch (err) {
          copyBtn.textContent = 'Copy failed';
          setTimeout(function () { copyBtn.textContent = 'Copy command'; }, 2000);
        }
      });

      window.addEventListener('message', function (event) {
        const msg = event.data;
        if (msg.type !== 'status') return;
        if (msg.ok) {
          indicator.innerHTML = checkSvg;
          text.textContent = 'CDP connected';
          detail.textContent = msg.detail || '';
          offlineHelp.style.display = 'block';
        } else {
          indicator.innerHTML = crossSvg;
          text.textContent = 'CDP offline';
          detail.textContent = (msg.cdpUrl || '') + ' — ' + (msg.detail || 'unreachable');
          offlineHelp.style.display = 'block';
        }
      });
    })();
  </script>
</body>
</html>`;
	}
}
