export const RT_EVENTS = {
	CONNECTION_STATE: "connection:state",
	AUTH_REQUEST: "auth:request",
	AUTH_SUCCESS: "auth:success",
	AUTH_ERROR: "auth:error",
	MESSAGE_SEND: "message:send",
	MESSAGE_RECEIVE: "message:receive",
} as const;

export type ConnectionStatePayload = {
	connected: boolean;
	authenticated: boolean;
	socketId: string;
};

export type AuthRequestPayload = {
	deviceToken: string;
	// keep simple now; can evolve to JWT/session later
	pairingToken?: string;
};

export type AuthSuccessPayload = {
	userId: string;
	computerName: string;
};

export type AuthErrorPayload = {
	code: "UNAUTHORIZED" | "BAD_PAYLOAD";
	message: string;
};

export type MessageSendPayload = {
	text: string;
	conversationId: string;
};

export type MessageReceivePayload = {
	id: string;
	text: string;
	conversationId: string;
	createdAt: number;
};
