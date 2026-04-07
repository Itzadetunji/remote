import Combine
import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published private(set) var title = "Cursor Remote"
    @Published private(set) var subtitle: String
    @Published private(set) var scanButtonTitle = "Scan Pairing QR"

    private let pushState: PushState
    private var cancellables = Set<AnyCancellable>()

    init(pushState: PushState = .shared) {
        self.pushState = pushState
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
        // Placeholder: wired for camera QR flow in next step.
    }
}
