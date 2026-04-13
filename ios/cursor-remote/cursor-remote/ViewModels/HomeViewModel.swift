import Combine
import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
  /// Single chat thread for now; server logs use this id.
  static let defaultConversationId = "default"

  @Published private(set) var subtitle: String
  @Published var isQRScannerPresented = false
  @Published var pairingError: String?
  @Published private(set) var realtimeState: RealtimeConnectionState =
    .disconnected
  @Published private(set) var chatMessages: [RealtimeMessage] = []

  private let pushState: PushState
  private let pairingClient: PairingClient
  private let pairedConnectionStore: PairedConnectionStore
  private var cancellables = Set<AnyCancellable>()
  private let realtimeSocketService: RealtimeSocketService

  var isConnected: Bool {
    pushState.connectedComputerName != nil
  }

  var realtimeStatusText: String {
    switch realtimeState {
    case .disconnected:
      return "Realtime: Disconnected"
    case .connectedUnauthenticated:
      return "Realtime: Connected (not authenticated)"
    case .authenticated:
      return "Realtime: Connected & authenticated"
    }
  }

  init(
    pushState: PushState? = nil,
    pairingClient: PairingClient = PairingClient(),
    pairedConnectionStore: PairedConnectionStore = PairedConnectionStore(),
    realtimeSocketService: RealtimeSocketService? = nil
  ) {
    self.pushState = pushState ?? .shared
    self.pairingClient = pairingClient
    self.pairedConnectionStore = pairedConnectionStore
    self.realtimeSocketService = realtimeSocketService ?? RealtimeSocketService()
    self.subtitle = self.pushState.subtitle
    if let persistedConnection = pairedConnectionStore.load() {
      self.pushState.setConnectedComputer(
        name: persistedConnection.displayName
      )
      if let token = self.pushState.deviceToken, !token.isEmpty {
        self.realtimeSocketService.connect(
          pairing: persistedConnection,
          deviceToken: token
        )
      }
    }
    self.chatMessages = self.realtimeSocketService.messages
    self.realtimeSocketService.$messages
      .receive(on: DispatchQueue.main)
      .sink { [weak self] messages in
        self?.chatMessages = messages
      }
      .store(in: &cancellables)

    self.realtimeSocketService.$state
      .receive(on: DispatchQueue.main)
      .sink { [weak self] newState in
        self?.realtimeState = newState
      }
      .store(in: &cancellables)

    self.pushState.objectWillChange
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

  func sendChatMessage(_ rawText: String) {
    realtimeSocketService.sendMessage(
      text: rawText,
      conversationId: Self.defaultConversationId
    )
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

      let paired = PairedConnection(
        baseURL: payload.baseURL,
        displayName: payload.displayName,
        pairingToken: payload.token,
        pairedAt: Date()
      )
      // Save successful pairing so users do not need to scan again next launch.
      try pairedConnectionStore.save(paired)

      pushState.setConnectedComputer(name: payload.displayName)
      realtimeSocketService.connect(
        pairing: paired,
        deviceToken: deviceTokenHex
      )
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
      let removed = try await pairingClient.disconnectDevice(
        baseURL: persisted.baseURL,
        deviceTokenHex: deviceTokenHex
      )
      if !removed {
        pairingError =
          "Disconnect was received but this device was not found on the server."
        pairedConnectionStore.clear()
        return
      }
    } catch {
      pairingError = "Disconnect failed: \(error.localizedDescription)"
      return
    }

    pairedConnectionStore.clear()
    realtimeSocketService.disconnect()
    pushState.setConnectedComputer(name: nil)
  }
}
