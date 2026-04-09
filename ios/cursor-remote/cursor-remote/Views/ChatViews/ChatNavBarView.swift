//
//  ChatNavBarView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 08/04/2026.
//

import SwiftUI

struct ChatNavBarView: View {
  var title: String = "Chat"
  var onMenu: () -> Void
  var onClose: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      HStack {
        navActionButton(systemName: "line.3.horizontal", action: onMenu)
          .accessibilityLabel("Open menu")

        Spacer()

        Text(title)
          .font(.headline)
          .lineLimit(1)

        Spacer()

        navActionButton(systemName: "xmark", action: onClose)
          .accessibilityLabel("Close chat")
      }
      .padding(.horizontal, 16)
      .frame(height: 44)

    }
  }
}

private func navActionButton(systemName: String, action: @escaping () -> Void) -> some View {
  Button(action: action) {
    Image(systemName: systemName)
      .font(.system(size: 17, weight: .semibold))
      .frame(width: 28, height: 28)
  }
  .buttonStyle(.glass)
  .foregroundStyle(.primary)
}

#Preview {
  ChatNavBarView(onMenu: {}, onClose: {})
}
