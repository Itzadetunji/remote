import Combine
import Foundation

@MainActor
final class PushState: ObservableObject {
  static let shared = PushState()

  @Published var deviceToken: String?
  @Published var statusMessage =
    "Push token registered. Scan pairing QR to connect."
  @Published var connectedComputerName: String?

  private init() {}

  var subtitle: String {
    if let connectedComputerName, !connectedComputerName.isEmpty {
      return "Connected to \(connectedComputerName)."
    }
    return statusMessage
  }

  func setConnectedComputer(name: String?) {
    connectedComputerName = name
  }
}
