
import Foundation

/// Persisted details we need to remember a successful pairing.
/// Keeping this small makes it easy to reason about and migrate later.
struct PairedConnection: Codable, Sendable {
    let baseURL: URL
    let displayName: String
    let pairingToken: String
    let pairedAt: Date
}
