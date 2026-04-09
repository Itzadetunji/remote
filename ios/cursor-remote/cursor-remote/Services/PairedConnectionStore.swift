import Foundation

/// Small storage wrapper for pairing persistence.
/// For a beginner-friendly setup, UserDefaults is enough for non-secret values.
struct PairedConnectionStore: Sendable {
    private let defaults: UserDefaults
    private let key = "paired_connection_v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func save(_ connection: PairedConnection) throws {
        let data = try JSONEncoder().encode(connection)
        defaults.set(data, forKey: key)
    }

    func load() -> PairedConnection? {
        guard let data = defaults.data(forKey: key) else {
            return nil
        }
        return try? JSONDecoder().decode(PairedConnection.self, from: data)
    }

    func clear() {
        defaults.removeObject(forKey: key)
    }
}
