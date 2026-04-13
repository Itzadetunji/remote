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

		const remote =
			socket.handshake.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
			socket.handshake.address;
		// eslint-disable-next-line no-console
		console.log(
			`[cursor-remote][realtime] Socket transport connected id=${socket.id} remote=${remote}`,
		);

		socket.emit(RT_EVENTS.CONNECTION_STATE, {
			connected: true,
			authenticated: false,
			socketId: socket.id,
		});

		socket.on(RT_EVENTS.AUTH_REQUEST, (payload: AuthRequestPayload) => {
			if (!payload?.deviceToken) {
				// eslint-disable-next-line no-console
				console.warn(
					`[cursor-remote][realtime] Auth rejected id=${socket.id} reason=BAD_PAYLOAD`,
				);
				socket.emit(RT_EVENTS.AUTH_ERROR, {
					code: "BAD_PAYLOAD",
					message: "deviceToken is required",
				});
				return;
			}

			if (!context.isKnownDeviceToken(payload.deviceToken)) {
				// eslint-disable-next-line no-console
				console.warn(
					`[cursor-remote][realtime] Auth rejected id=${socket.id} reason=UNAUTHORIZED device=${payload.deviceToken.slice(0, 8)}…`,
				);
				socket.emit(RT_EVENTS.AUTH_ERROR, {
					code: "UNAUTHORIZED",
					message: "Unauthorized",
				});
				return;
			}

			socket.data.authenticated = true;

			// eslint-disable-next-line no-console
			console.log(
				`[cursor-remote][realtime] Socket authenticated id=${socket.id} device=${payload.deviceToken.slice(0, 8)}… computer="${context.getComputerName()}"`,
			);

			socket.emit(RT_EVENTS.AUTH_SUCCESS, {
				userId: payload.deviceToken.slice(0, 8),
				computerName: context.getComputerName(),
			});

			socket.emit(RT_EVENTS.CONNECTION_STATE, {
				connected: true,
				authenticated: true,
				socketId: socket.id,
			});
		});

		socket.on("disconnect", (reason) => {
			// eslint-disable-next-line no-console
			console.log(
				`[cursor-remote][realtime] Socket disconnected id=${socket.id} reason=${reason}`,
			);
		});
	});

	return io;
};
