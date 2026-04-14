import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = HomeViewModel()
    @State private var showChat = false
    @Environment(\.scenePhase) private var scenePhase

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
                ChatView(viewModel: viewModel)
            }
            .onOpenURL { url in
                Task { await viewModel.handleScannedPairingCode(url.absoluteString) }
            }
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    viewModel.sceneDidBecomeActive()
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
