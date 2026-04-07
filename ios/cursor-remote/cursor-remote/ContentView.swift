import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = HomeViewModel()

    var body: some View {
        ZStack {
            Color.black
                .ignoresSafeArea()

            VStack(spacing: 20) {
                Spacer()

                VStack(spacing: 14) {
                    Text(viewModel.title)
                        .font(SofiaFont.semiBold(size: 18))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.center)

                    Text(viewModel.subtitle)
                        .font(
                            .system(
                                size: 22,
                                weight: .regular,
                                design: .default
                            )
                        )
                        .foregroundStyle(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 36)
                }

                Button(action: viewModel.scanPairingQR) {
                    Text(viewModel.scanButtonTitle)
                        .font(
                            .system(
                                size: 18,
                                weight: .regular,
                                design: .default
                            )
                        )
                        .foregroundStyle(.white)
                        .padding(.vertical, 0)
                        .padding(.horizontal, 0)
                }
                .buttonStyle(.borderedProminent)
                .tint(.blue)
                .controlSize(.large)
                .clipShape(Capsule())
                .accessibilityLabel("Scan pairing QR code")

                Spacer()
            }
            .padding(.horizontal, 24)
        }
    }
}

#Preview {
    ContentView()
}
