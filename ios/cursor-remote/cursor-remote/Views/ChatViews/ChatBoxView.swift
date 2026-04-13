//
//  ChatTextView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 08/04/2026.
//

import SwiftUI

struct ChatBoxView: View {
  @State private var text = ""
  @Environment(\.colorScheme) private var colorScheme
  @FocusState.Binding var isEditorFocused: Bool
  var canSend: Bool
  var onSend: (String) -> Void

  private var trimmed: String {
    text.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private var sendEnabled: Bool {
    canSend && !trimmed.isEmpty
  }

  var body: some View {
    VStack {
      VStack(alignment: .leading, spacing: 0) {
        ZStack(alignment: .topLeading) {
          if text.isEmpty {
            Text("What do you want to build today?")
              .foregroundStyle(.secondary)
              .padding(.top, 24)  // match TextEditor's text inset
              .padding(.leading, 20)  // match TextEditor's text inset
              .allowsHitTesting(false)
          }

          TextEditor(text: $text)
            .padding(16)
            .frame(
              maxWidth: .infinity,
              maxHeight: .infinity,
              alignment: .topLeading
            )
            .focused($isEditorFocused)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
        }

        HStack {
          if !canSend {
            Text("Connect and authenticate to send.")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          Spacer()
          Button(action: {
            guard sendEnabled else { return }
            onSend(trimmed)
            text = ""
            isEditorFocused = false
          }) {
            Image(systemName: "arrow.up")
              .font(.system(size: 16, weight: .semibold))
          }
          .frame(width: 32, height: 32)
          .buttonStyle(.glass)
          .foregroundStyle(.primary)
          .opacity(sendEnabled ? 1 : 0.35)
          .disabled(!sendEnabled)
          .clipShape(
            RoundedRectangle(cornerRadius: 48, style: .continuous)
          )

        }.padding(8)
      }.frame(height: 150)
        .padding(10)
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemBackground))
        .clipShape(
          RoundedRectangle(cornerRadius: 48, style: .continuous)
        )
        .shadow(
          color: (colorScheme == .dark
            ? Color.white.opacity(0.1)
            : Color.black.opacity(0.08)),
          radius: 10,
          x: 0,
          y: 4
        )

    }
    .padding(.horizontal, 16)

  }
}

#Preview {
  @Previewable @FocusState var isEditorFocused: Bool
  ChatBoxView(
    isEditorFocused: $isEditorFocused,
    canSend: true,
    onSend: { _ in }
  )
}
