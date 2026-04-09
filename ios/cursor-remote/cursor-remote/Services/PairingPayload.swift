import Foundation

enum PairingPayloadError: LocalizedError {
  case invalidFormat
  case missingBaseURL
  case missingToken
  case invalidBaseURL

  var errorDescription: String? {
    switch self {
    case .invalidFormat:
      return "This QR code is not a valid Cursor Remote pairing code."
    case .missingBaseURL:
      return "Pairing data is missing the service address."
    case .missingToken:
      return "Pairing data is missing the security token."
    case .invalidBaseURL:
      return "The service address in this QR code is not valid."
    }
  }
}

struct PairingPayload: Sendable {
  let baseURL: URL
  let token: String
    let displayNameFromQR: String?

  /// Parses `cursorremote://pair?baseUrl=...&token=...` from the pairing server.
  static func parse(_ raw: String) throws -> PairingPayload {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let components = URLComponents(string: trimmed),
      components.scheme?.lowercased() == "cursorremote",
      components.host?.lowercased() == "pair"
    else {
      throw PairingPayloadError.invalidFormat
    }

    let items = components.queryItems ?? []
    let baseUrlString =
      items.first { $0.name == "baseUrl" }?.value
    let token =
      items.first { $0.name == "token" }?.value
        let displayNameRaw =
            items.first { $0.name == "displayName" }?.value

    guard let baseUrlString, !baseUrlString.isEmpty else {
      throw PairingPayloadError.missingBaseURL
    }
    guard let token, !token.isEmpty else {
      throw PairingPayloadError.missingToken
    }

    let decoded = baseUrlString.removingPercentEncoding ?? baseUrlString
    guard let baseURL = URL(string: decoded),
      let scheme = baseURL.scheme?.lowercased(),
      scheme == "http" || scheme == "https"
    else {
      throw PairingPayloadError.invalidBaseURL
    }

        let displayName = displayNameRaw?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return PairingPayload(
            baseURL: baseURL,
            token: token,
            displayNameFromQR: (displayName?.isEmpty == false) ? displayName : nil
        )
  }

    /// Human-readable label for the connected service.
    /// Prefer the explicit machine name sent in QR payload, then fall back to host.
  var displayName: String {
        if let displayNameFromQR, !displayNameFromQR.isEmpty {
            return displayNameFromQR
        }
    return baseURL.host ?? baseURL.absoluteString
  }
}
