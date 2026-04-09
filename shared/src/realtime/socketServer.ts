import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { type AuthRequestPayload, RT_EVENTS } from "./protocol";

export type RealtimeContext = {
	// use your existing pairing server/device registry
	isKnownDeviceToken: (token: string) => boolean;
	getComputerName: () => string;
};

export const createSocketServer = (
	httpServer: HttpServer,
	context: RealtimeContext,
) => {
	const io = new SocketServer(httpServer, {
		cors: { origin: "*" },
	});

	io.on("connection", (socket) => {
		socket.data.authenticated = false;

		socket.emit(RT_EVENTS.CONNECTION_STATE, {
			connected: true,
			authenticated: false,
			socketId: socket.id,
		});

		socket.on(RT_EVENTS.AUTH_REQUEST, (payload: AuthRequestPayload) => {
			if (!payload?.deviceToken) {
				socket.emit(RT_EVENTS.AUTH_ERROR, {
					code: "BAD_PAYLOAD",
					message: "deviceToken is required",
				});
				return;
			}

			if (!context.isKnownDeviceToken(payload.deviceToken)) {
				socket.emit(RT_EVENTS.AUTH_ERROR, {
					code: "UNAUTHORIZED",
					message: "Unauthorized",
				});
				return;
			}

			socket.data.authenticated = true;

			socket.emit(RT_EVENTS.AUTH_SUCCESS, {
				userId: payload.deviceToken.slice(0, 8),
				computerName: context.getComputerName(),
			});

			socket.emit(RT_EVENTS.CONNECTION_STATE, {
				connected: true,
				authenticated: true,
				socketId: socket.id,
			});

			socket.on("disconnect", () => {
				//
			});
		});
	});

	return io;
};
