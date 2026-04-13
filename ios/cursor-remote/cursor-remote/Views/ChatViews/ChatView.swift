//
//  ChatView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 07/04/2026.
//

import SwiftUI

struct ChatView: View {
    @ObservedObject var viewModel: HomeViewModel
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isChatInputFocused: Bool

    var body: some View {
        GeometryReader { geo in
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        if viewModel.chatMessages.isEmpty {
                            ContentUnavailableView(
                                "No messages yet",
                                systemImage: "bubble.left.and.bubble.right",
                                description: Text(
                                    "Send a message below. It appears here right away and is printed on the Mac service log."
                                )
                            )
                            .frame(maxWidth: .infinity, minHeight: geo.size.height * 0.35)
                            .padding(.top, 24)
                        } else {
                            ForEach(viewModel.chatMessages) { message in
                                ChatBubbleRow(message: message)
                                    .id(message.id)
                            }
                        }
                    }
                    .frame(
                        maxWidth: .infinity,
                        minHeight: geo.size.height,
                        alignment: .top
                    )
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                }
                .onChange(of: viewModel.chatMessages.count) { _, _ in
                    if let last = viewModel.chatMessages.last {
                        withAnimation(.easeOut(duration: 0.2)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                isChatInputFocused = false
            }

            .background(Color(uiColor: .systemBackground))
            .safeAreaInset(edge: .top, spacing: 0) {
                ChatNavBarView(
                    title: "Chat",
                    onMenu: {},
                    onClose: { dismiss() }
                )

            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                ChatBoxView(
                    isEditorFocused: $isChatInputFocused,
                    canSend: viewModel.realtimeState == .authenticated,
                    onSend: { viewModel.sendChatMessage($0) }
                )

            }
        }
        .background(Color(uiColor: .systemBackground))
        .navigationBarBackButtonHidden(true)
    }
}

private struct ChatBubbleRow: View {
    let message: RealtimeMessage

    var body: some View {
        HStack {
            if message.isOutbound {
                Spacer(minLength: 48)
            }
            Text(message.text)
                .font(.body)
                .foregroundStyle(.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(message.isOutbound
                            ? Color.accentColor.opacity(0.22)
                            : Color(uiColor: .secondarySystemFill))
                }
            if !message.isOutbound {
                Spacer(minLength: 48)
            }
        }
    }
}

#Preview {
    ChatView(viewModel: HomeViewModel())
}
