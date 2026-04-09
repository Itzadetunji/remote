//
//  ChatView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 07/04/2026.
//

import SwiftUI

struct ChatView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {

        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 16) {
                    ContentUnavailableView(
                        "No messages yet",
                        systemImage: "bubble.left.and.bubble.right",
                        description: Text(
                            "Pair your device from the Scan tab to start chatting."
                        )
                    )
                }
                .frame(
                    maxWidth: .infinity,
                    minHeight: geo.size.height, // <- key line
                    alignment: .center
                )
                .padding(.horizontal, 16)
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
                ChatBoxView()

            }
        }
        .background(Color(uiColor: .systemBackground))
        .navigationBarBackButtonHidden(true)
    }
}

#Preview {
    ChatView()
}
