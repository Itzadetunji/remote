import express, { type Express, type Request } from "express";
import { networkInterfaces } from "node:os";
import { type AddressInfo } from "node:net";
import { createServer, type Server as HttpServer } from "node:http";

export interface RegisteredDevice {
	deviceToken: string;
	platform: string;
	updatedAt: number;
}

export interface PairingServerOptions {
	host: string;
	port: number;
	pairingToken: string;
	/** Called when a **new** device token registers (not on every re-POST). */
	onDeviceRegistered?: (device: RegisteredDevice) => void;
	/** Optional hook for host-specific routes (commands, status, etc.). */
	registerRoutes?: (app: Express, server: PairingServer) => void;
}

function getBearerToken(request: Request): string | undefined {
	const header = request.header("authorization");
	if (!header?.startsWith("Bearer ")) {
		return undefined;
	}

	return header.slice("Bearer ".length).trim();
}

function getLanIPv4Address(): string | undefined {
	const nets = networkInterfaces();
	for (const netInfo of Object.values(nets)) {
		if (!netInfo) {
			continue;
		}
		for (const net of netInfo) {
			if (net.family === "IPv4" && !net.internal) {
				return net.address;
			}
		}
	}

	return undefined;
}

export class PairingServer {
	private readonly app = express();
	private readonly options: PairingServerOptions;
	private readonly devices = new Map<string, RegisteredDevice>();
	private httpServer: HttpServer | undefined;

	public constructor(options: PairingServerOptions) {
		this.options = options;
		this.app.use(express.json());
		this.registerRoutes();
		this.options.registerRoutes?.(this.app, this);
	}

	public getPort(): number {
		const address = this.httpServer?.address() as AddressInfo | null;
		return address?.port ?? this.options.port;
	}

	public getHostForClients(): string {
		if (this.options.host === "0.0.0.0") {
			return getLanIPv4Address() ?? "127.0.0.1";
		}
		return this.options.host;
	}

	public getBaseUrl(): string {
		return `http://${this.getHostForClients()}:${this.getPort()}`;
	}

	public getPairingPayload(): string {
		const baseUrl = encodeURIComponent(this.getBaseUrl());
		return `cursorremote://pair?baseUrl=${baseUrl}&token=${this.options.pairingToken}`;
	}

	public listDevices(): RegisteredDevice[] {
		return [...this.devices.values()];
	}

	public async start(): Promise<void> {
		if (this.httpServer) {
			return;
		}

		await new Promise<void>((resolve, reject) => {
			this.httpServer = createServer(this.app);
			this.httpServer.once("error", reject);
			this.httpServer.listen(this.options.port, this.options.host, () => {
				this.httpServer?.off("error", reject);
				resolve();
			});
		});
	}

	public async stop(): Promise<void> {
		if (!this.httpServer) {
			return;
		}

		const server = this.httpServer;
		this.httpServer = undefined;
		await new Promise<void>((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}

	private registerRoutes(): void {
		this.app.get("/health", (_req, res) => {
			res.json({
				ok: true,
				devices: this.devices.size,
			});
		});

		this.app.post("/devices", (req, res) => {
			const bearerToken = getBearerToken(req);
			if (bearerToken !== this.options.pairingToken) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			const body = req.body as Partial<RegisteredDevice>;
			if (!body.deviceToken || !body.platform) {
				res.status(400).json({ error: "deviceToken and platform are required." });
				return;
			}

			const record: RegisteredDevice = {
				deviceToken: body.deviceToken,
				platform: body.platform,
				updatedAt: Date.now(),
			};

			const isNew = !this.devices.has(record.deviceToken);
			this.devices.set(record.deviceToken, record);

			res.json({ ok: true });

			if (isNew && this.options.onDeviceRegistered) {
				try {
					this.options.onDeviceRegistered(record);
				} catch {
					// ignore callback errors
				}
			}
		});
	}
}
