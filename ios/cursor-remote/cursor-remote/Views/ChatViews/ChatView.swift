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

    private var lastMessageText: String? {
        viewModel.chatMessages.last?.text
    }

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
                                    "Send a message below. It is injected into Cursor on your Mac; the assistant reply streams back here."
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
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: lastMessageText) { _, _ in
                    scrollToBottom(proxy: proxy)
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

    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let last = viewModel.chatMessages.last {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}

/// Role labels and alignment echo len-cursor Telegram formatting (You: / assistant body).
private struct ChatBubbleRow: View {
    let message: RealtimeMessage

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            if message.isOutbound {
                Spacer(minLength: 40)
                VStack(alignment: .trailing, spacing: 6) {
                    Text("You")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                    Text(message.text)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.trailing)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color.accentColor.opacity(0.2))
                        }
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("Assistant")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                        if message.isStreaming {
                            ProgressView()
                                .scaleEffect(0.85)
                        }
                    }
                    Text(message.text)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(Color(uiColor: .secondarySystemFill))
                        }
                }
                Spacer(minLength: 40)
            }
        }
    }
}

#Preview {
    ChatView(viewModel: HomeViewModel())
}
