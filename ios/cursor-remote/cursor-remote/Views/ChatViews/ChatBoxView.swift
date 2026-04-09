//
//  ChatTextView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 08/04/2026.
//

import SwiftUI

struct ChatBoxView: View {
    @State private var text = ""
    var body: some View {
        TextEditor(text: $text)
            .frame(height: 150)
            .border(Color.gray)
    }
}

#Preview {
    ChatBoxView()
}
