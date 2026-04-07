import Combine
import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var subtitle: String
    @Published var isQRScannerPresented = false
    @Published var pairingError: String?

    private let pushState: PushState
    private let pairingClient: PairingClient
    private var cancellables = Set<AnyCancellable>()

    init(pushState: PushState = .shared, pairingClient: PairingClient = PairingClient()) {
        self.pushState = pushState
        self.pairingClient = pairingClient
        self.subtitle = pushState.subtitle

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
            guard let deviceTokenHex = pushState.deviceToken, !deviceTokenHex.isEmpty else {
                pairingError =
                    "Notifications are not ready yet. Allow notifications when prompted, wait a moment, then scan again."
                return
            }
            try await pairingClient.registerDevice(
                baseURL: payload.baseURL,
                bearerToken: payload.token,
                deviceTokenHex: deviceTokenHex
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
}
