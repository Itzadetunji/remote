import type { Express, Request, Response } from "express";
import type { PairingServer } from "@cursorremote/shared";
import { checkCdp, sendTestPush, type ServerContext } from "../commands/handlers";

export function createRegisterRoutes(getContext: () => ServerContext) {
	return (app: Express, svc: PairingServer): void => {
		app.get("/pairing", (_req: Request, res: Response) => {
			res.json({
				payload: svc.getPairingPayload(),
				baseUrl: svc.getBaseUrl(),
				devices: svc.listDevices().length,
			});
		});

		app.post("/commands/check-cdp", async (_req: Request, res: Response) => {
			try {
				const { result } = await checkCdp(getContext());
				res.json({ ok: true, result });
			} catch (error) {
				res.status(500).json({ ok: false, error: (error as Error).message });
			}
		});

		app.post("/commands/send-test-push", async (req: Request, res: Response) => {
			try {
				const body =
					typeof req.body?.body === "string" ? req.body.body : undefined;
				const { sent, failed } = await sendTestPush(getContext(), body);
				res.json({ ok: true, sent, failed });
			} catch (error) {
				res.status(500).json({ ok: false, error: (error as Error).message });
			}
		});
	};
}
