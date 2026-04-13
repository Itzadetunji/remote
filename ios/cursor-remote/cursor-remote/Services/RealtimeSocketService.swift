//
//  RealtimeSocketService.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 09/04/2026.
//

import Combine
import Foundation
import SocketIO

@MainActor
final class RealtimeSocketService: ObservableObject {
    // Keep these names aligned with shared/src/realtime/protocol.ts
    private enum Event {
        static let connectionState = "connection:state"
        static let authRequest = "auth:request"
        static let authSuccess = "auth:success"
        static let authError = "auth:error"
        static let messageSend = "message:send"
        static let messageReceive = "message:receive"
    }

    /// ANSI colors for Xcode / device console (visible in most modern terminals).
    private enum Log {
        static let outgoing = "\u{001B}[35m"  // magenta — client → server
        static let incoming = "\u{001B}[36m"  // cyan — server → client
        static let reset = "\u{001B}[0m"

        static func describe(_ data: [Any]) -> String {
            data.map { item -> String in
                if let d = item as? [String: Any],
                    let json = try? JSONSerialization.data(
                        withJSONObject: d,
                        options: [.sortedKeys, .prettyPrinted]
                    ),
                    let s = String(data: json, encoding: .utf8)
                {
                    return s
                }
                if let arr = item as? [Any] {
                    return describe(arr)
                }
                return String(describing: item)
            }.joined(separator: " ")
        }

        static func describePayload(_ payload: [String: Any]) -> String {
            guard
                let json = try? JSONSerialization.data(
                    withJSONObject: payload,
                    options: [.sortedKeys, .prettyPrinted]
                ),
                let s = String(data: json, encoding: .utf8)
            else { return String(describing: payload) }
            return s
        }

        static func out(_ event: String, payload: [String: Any]) {
            print(
                "\(outgoing)[WS →]\(reset) \(event) \(describePayload(payload))"
            )
        }

        static func `in`(_ event: String, data: [Any]) {
            print("\(incoming)[WS ←]\(reset) \(event) \(describe(data))")
        }
    }

    @Published private(set) var state: RealtimeConnectionState = .disconnected
    @Published private(set) var lastError: String?
    @Published private(set) var messages: [RealtimeMessage] = []

    private var manager: SocketManager?
    private var socket: SocketIOClient?

    private var currentPairing: PairedConnection?
    private var currentDeviceToken: String?

    func connect(pairing: PairedConnection, deviceToken: String) {
        // Store context used for auth handshake.
        currentPairing = pairing
        currentDeviceToken = deviceToken
        lastError = nil

        // Build manager fresh each time for simplicity.
        manager = SocketManager(
            socketURL: pairing.baseURL,
            config: [
                .log(true),
                .compress,
                .forceWebsockets(true),
                .reconnects(true),
                .reconnectAttempts(-1),
            ]
        )

        guard let manager else { return }
        let client = manager.defaultSocket
        socket = client

        // Socket transport connected (but not authenticated yet).
        client.on(clientEvent: .connect) {
            [weak self] _, _ in
            guard let self else { return }
            Log.in("socket.io:connect", data: [])
            self.state = .connectedUnauthenticated
            self.emitAuthRequest()
        }

        client.on(clientEvent: .disconnect) {
            [weak self] data, _ in
            guard let self else { return }
            Log.in("socket.io:disconnect", data: data)
            self.state = .disconnected
        }

        client.on(Event.connectionState) { [weak self] data, _ in
            guard let self else { return }
            Log.in(Event.connectionState, data: data)
            guard let payload = data.first as? [String: Any] else { return }

            let connected = payload["connected"] as? Bool ?? false
            let authenticated = payload["authenticated"] as? Bool ?? false

            if !connected {
                self.state = .disconnected
            } else if authenticated {
                self.state = .authenticated
            } else {
                self.state = .connectedUnauthenticated
            }
        }

        client.on(Event.authSuccess) {
            [weak self] data, _ in
            guard let self else { return }
            Log.in(Event.authSuccess, data: data)
            self.state = .authenticated
            self.lastError = nil
        }

        client.on(Event.authError) {
            [weak self] data, _ in
            guard let self else { return }
            Log.in(Event.authError, data: data)
            self.state = .connectedUnauthenticated

            let payload = data.first as? [String: Any]
            let message =
                payload?["message"] as? String ?? "Authentication failed."
            self.lastError = message
        }

        client.on(Event.messageReceive) {
            [weak self] data, _ in
            guard let self else { return }
            Log.in(Event.messageReceive, data: data)
            guard let payload = data.first as? [String: Any] else { return }

            guard
                let id = payload["id"] as? String,
                let text = payload["text"] as? String,
                let conversationId = payload["conversationId"] as? String
            else {
                return
            }

            let createdAtMs =
                payload["createdAt"] as? Double ?? Date()
                .timeIntervalSince1970 * 1000
            let createdAt = Date(timeIntervalSince1970: createdAtMs / 1000)

                self.messages.append(
                    RealtimeMessage(
                        id: id,
                        text: text,
                        conversationId: conversationId,
                        createdAt: createdAt,
                        isOutbound: false
                    )
                )
        }

        client.connect()
    }
    func disconnect() {
        socket?.disconnect()
        socket?.removeAllHandlers()
        socket = nil
        manager = nil
        state = .disconnected
    }

    func sendMessage(text: String, conversationId: String) {
        guard state == .authenticated else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let localId = UUID().uuidString
        messages.append(
            RealtimeMessage(
                id: localId,
                text: trimmed,
                conversationId: conversationId,
                createdAt: Date(),
                isOutbound: true
            )
        )

        let payload: [String: Any] = [
            "text": trimmed,
            "conversationId": conversationId,
        ]
        Log.out(Event.messageSend, payload: payload)
        socket?.emit(
            Event.messageSend,
            payload
        )
    }

    private func emitAuthRequest() {
        guard let socket, let deviceToken = currentDeviceToken else { return }
        // pairingToken is optional in your protocol, keep it for now.
        var payload: [String: Any] = [
            "deviceToken": deviceToken
        ]
        if let pairingToken = currentPairing?.pairingToken {
            payload["pairingToken"] = pairingToken
        }
        Log.out(Event.authRequest, payload: payload)
        socket.emit(Event.authRequest, payload)
    }

}

struct RealtimeMessage: Identifiable, Equatable {
    let id: String
    let text: String
    let conversationId: String
    let createdAt: Date
    /// `true` for messages typed on this device; `false` for `message:receive` from the server.
    var isOutbound: Bool = false
}
