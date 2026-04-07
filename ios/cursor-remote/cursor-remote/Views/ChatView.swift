//
//  ChatView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 07/04/2026.
//

import SwiftUI

struct ChatView: View {
    var body: some View {
        ContentUnavailableView(
            "No messages yet",
            systemImage: "bubble.left.and.bubble.right",
            description: Text("Pair your device from the Scan tab to start chatting.")
        )
    }
}

#Preview {
    ChatView()
}
