//
//  ScanQRCodeView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 07/04/2026.
//

import SwiftUI

struct ScanQRCodeView: View {
    let viewModel: HomeViewModel

    var body: some View {

        VStack(spacing: 20) {
            Spacer()

            VStack(spacing: 14) {
                Text("Cursor Remote")
                    .font(SofiaFont.semiBold(size: 18))
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.center)

                Text(viewModel.subtitle)
                    .font(SofiaFont.regular(size: 18))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 36)
            }

            Button(action: viewModel.scanPairingQR) {
                Text("Scan QR Code")
                    .font(SofiaFont.regular(size: 18))
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

#Preview {
    ScanQRCodeView(viewModel: HomeViewModel())
}
