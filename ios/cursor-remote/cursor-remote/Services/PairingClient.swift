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
        let url = baseURL.appendingPathComponent("devices")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "Bearer \(bearerToken)",
            forHTTPHeaderField: "Authorization"
        )
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        let body = DeviceRegistrationBody(
            deviceToken: deviceTokenHex,
            platform: "ios"
        )
        request.httpBody = try JSONEncoder().encode(body)

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

    /// POST `{baseURL}/devices/disconnect` with Bearer token and JSON body.
    func disconnectDevice(
        baseURL: URL,
        bearerToken: String,
        deviceTokenHex: String
    ) async throws {
        let url = baseURL.appendingPathComponent("devices/disconnect")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(
            "Bearer \(bearerToken)",
            forHTTPHeaderField: "Authorization"
        )
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        let body = DeviceDisconnectBody(deviceToken: deviceTokenHex)
        request.httpBody = try JSONEncoder().encode(body)
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
