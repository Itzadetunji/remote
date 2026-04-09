import Combine
import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var subtitle: String
    @Published var isQRScannerPresented = false
    @Published var pairingError: String?

    private let pushState: PushState
    private let pairingClient: PairingClient
    private let pairedConnectionStore: PairedConnectionStore
    private var cancellables = Set<AnyCancellable>()

    var isConnected: Bool {
        pushState.connectedComputerName != nil
    }

    init(
        pushState: PushState = .shared,
        pairingClient: PairingClient = PairingClient(),
        pairedConnectionStore: PairedConnectionStore = PairedConnectionStore()
    ) {
        self.pushState = pushState
        self.pairingClient = pairingClient
        self.pairedConnectionStore = pairedConnectionStore
        self.subtitle = pushState.subtitle

        // On every app launch, try to restore a previous successful pairing.
        if let persistedConnection = pairedConnectionStore.load() {
            pushState.setConnectedComputer(
                name: persistedConnection.displayName
            )
        }

        pushState.objectWillChange
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                self.subtitle = self.pushState.subtitle
            }
            .store(in: &cancellables)
    }

    func scanPairingQR() {
        pairingError = nil
        isQRScannerPresented = true
    }

    func dismissQRScanner() {
        isQRScannerPresented = false
    }

    /// Parses QR text, registers this device with the pairing server, then updates `PushState`.
    func handleScannedPairingCode(_ raw: String) async {
        pairingError = nil
        do {
            let payload = try PairingPayload.parse(raw)
            guard let deviceTokenHex = pushState.deviceToken,
                !deviceTokenHex.isEmpty
            else {
                pairingError =
                    "Notifications are not ready yet. Allow notifications when prompted, wait a moment, then scan again."
                return
            }
            try await pairingClient.registerDevice(
                baseURL: payload.baseURL,
                bearerToken: payload.token,
                deviceTokenHex: deviceTokenHex
            )

            // Save successful pairing so users do not need to scan again next launch.
            try pairedConnectionStore.save(
                PairedConnection(
                    baseURL: payload.baseURL,
                    displayName: payload.displayName,
                    pairingToken: payload.token,
                    pairedAt: Date()
                )
            )

            pushState.setConnectedComputer(name: payload.displayName)
            isQRScannerPresented = false
        } catch let error as PairingPayloadError {
            pairingError = error.localizedDescription
        } catch let error as PairingClientError {
            pairingError = error.localizedDescription
        } catch {
            pairingError = error.localizedDescription
        }
    }

    /// Disconnect this phone from the paired server and clear local pairing state.
    func disconnect() async {
        pairingError = nil

        guard let persisted = pairedConnectionStore.load() else {
            pushState.setConnectedComputer(name: nil)
            return
        }

        guard let deviceTokenHex = pushState.deviceToken,
            !deviceTokenHex.isEmpty
        else {
            pairingError =
                "Device toekn is missing. Restart the app and try agian"
            return
        }

        do {
            try await pairingClient.disconnectDevice(
                baseURL: persisted.baseURL,
                bearerToken: persisted.pairingToken,
                deviceTokenHex: deviceTokenHex
            )
        } catch {
            // If server is unreachable, still clear local state so user can re-pair.
            // You can choose stricter behavior later.
        }

        pairedConnectionStore.clear()
        pushState.setConnectedComputer(name: nil)
    }
}
