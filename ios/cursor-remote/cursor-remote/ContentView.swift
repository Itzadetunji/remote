import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = HomeViewModel()
    @State private var showChat = false

    var body: some View {
        NavigationStack {
            ScanQRCodeView(viewModel: viewModel)
            .navigationTitle("Cursor Remote")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showChat = true
                    } label: {
                        Image(systemName: "message")
                            .symbolRenderingMode(.hierarchical)
                    }
                    .accessibilityLabel("Open chat")
                }
            }
            .navigationDestination(isPresented: $showChat) {
                ChatView()
                    .navigationTitle("Chat")
                    .navigationBarTitleDisplayMode(.inline)
            }
            .onOpenURL { url in
                Task { await viewModel.handleScannedPairingCode(url.absoluteString) }
            }
        }
    }
}

#Preview {
    ContentView()
}
