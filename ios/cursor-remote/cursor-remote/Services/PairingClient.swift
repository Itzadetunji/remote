import Foundation

enum PairingClientError: LocalizedError {
    case invalidResponse
    case httpStatus(Int, String?)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Unexpected response from the pairing service."
        case .httpStatus(let code, let body):
            if code == 401 {
                return
                    "Pairing was rejected. Check that the QR code is current."
            }
            if let body, !body.isEmpty {
                return "Pairing failed (\(code)): \(body)"
            }
            return "Pairing failed with status \(code)."
        case .transport(let error):
            return Self.pairingFriendlyTransportMessage(for: error)
        }
    }

    /// System text like “The internet connection appears to be offline” often means no route to a **local** URL (LAN / permissions), not the public internet.
    private static func pairingFriendlyTransportMessage(for error: Error)
        -> String
    {
        let urlError = error as? URLError
        switch urlError?.code {
        case .notConnectedToInternet:
            return """
                Couldn’t reach the pairing service on your network. Try:
                • iPhone and Mac on the same Wi‑Fi (not guest / isolated VLAN)
                • Settings → Privacy & Security → Local Network → enable Cursor Remote
                • Turn off VPN on the phone if it blocks local addresses
                • Regenerate the QR on the Mac so it shows your computer’s LAN IP (not 127.0.0.1)
                """
                .trimmingCharacters(in: .whitespacesAndNewlines)
        case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
            return
                "Couldn’t connect to that address. Check the Mac is running Cursor Remote, the port isn’t blocked by a firewall, and the QR uses your Mac’s Wi‑Fi IP."
        case .timedOut:
            return
                "The connection timed out. Move closer to the router or check that the pairing server is still running on your Mac."
        case .networkConnectionLost:
            return
                "The connection dropped. Stay on Wi‑Fi and try scanning again."
        default:
            break
        }
        return error.localizedDescription
    }
}

struct PairingClient: Sendable {
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(session: URLSession = PairingClient.makeDefaultSession()) {
        self.session = session
    }

    private static func makeDefaultSession() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.waitsForConnectivity = false
        configuration.allowsConstrainedNetworkAccess = true
        configuration.allowsExpensiveNetworkAccess = true
        return URLSession(configuration: configuration)
    }

    /// POST `{baseURL}/devices` with Bearer token and JSON body per pairing server.
    func registerDevice(
        baseURL: URL,
        bearerToken: String,
        deviceTokenHex: String
    ) async throws {
        let body = DeviceRegistrationBody(
            deviceToken: deviceTokenHex,
            platform: "ios"
        )
        let request = try makeRequest(
            baseURL: baseURL,
            path: "devices",
            method: "POST",
            bearerToken: bearerToken,
            body: body
        )
        try await sendWithoutDecoding(request)
    }

    /// POST `{baseURL}/devices/disconnect` with JSON body.
    /// Returns `true` when the server confirms the token was removed.
    func disconnectDevice(
        baseURL: URL,
        deviceTokenHex: String
    ) async throws -> Bool {
        let body = DeviceDisconnectBody(deviceToken: deviceTokenHex)
        let request = try makeRequest(
            baseURL: baseURL,
            path: "devices/disconnect",
            method: "POST",
            body: body
        )
        let response = try await send(request, decodeAs: DeviceDisconnectResponse.self)
        return response.removed
    }

    /// Builds a request with shared defaults so endpoint methods stay small.
    private func makeRequest<Body: Encodable>(
        baseURL: URL,
        path: String,
        method: String,
        bearerToken: String? = nil,
        body: Body? = nil
    ) throws -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        if let bearerToken, !bearerToken.isEmpty {
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = try encoder.encode(body)
        }
        return request
    }

    /// Sends request, validates status codes, and decodes typed responses.
    private func send<Response: Decodable>(
        _ request: URLRequest,
        decodeAs responseType: Response.Type
    ) async throws -> Response {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw PairingClientError.invalidResponse
            }
            guard (200...299).contains(http.statusCode) else {
                let text = String(data: data, encoding: .utf8)
                throw PairingClientError.httpStatus(http.statusCode, text)
            }

            return try decoder.decode(responseType, from: data)
        } catch let error as PairingClientError {
            throw error
        } catch {
            throw PairingClientError.transport(error)
        }
    }

    /// Sends request and only validates success status (no response decoding).
    private func sendWithoutDecoding(_ request: URLRequest) async throws {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw PairingClientError.invalidResponse
            }
            guard (200...299).contains(http.statusCode) else {
                let text = String(data: data, encoding: .utf8)
                throw PairingClientError.httpStatus(http.statusCode, text)
            }
        } catch let error as PairingClientError {
            throw error
        } catch {
            throw PairingClientError.transport(error)
        }
    }
}

private struct DeviceRegistrationBody: Encodable {
    let deviceToken: String
    let platform: String
}

private struct DeviceDisconnectBody: Encodable {
    let deviceToken: String
}

private struct DeviceDisconnectResponse: Decodable {
    let ok: Bool
    let removed: Bool
}
