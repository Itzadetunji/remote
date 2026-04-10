//
//  ScanQRCodeView.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 07/04/2026.
//

import SwiftUI

struct ScanQRCodeView: View {
    @ObservedObject var viewModel: HomeViewModel

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

                Text(viewModel.realtimeStatusText)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 36)
            }

            if viewModel.isConnected {
                Button {
                    Task { await viewModel.disconnect() }
                } label: {
                    Text("Disconnect")
                        .font(SofiaFont.regular(size: 18))
                        .foregroundStyle(.white)
                        .padding(.vertical, 0)
                        .padding(.horizontal, 0)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .controlSize(.large)
                .clipShape(Capsule())
                .accessibilityLabel("Disconnect from paired computer")
            } else {
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
            }

            Spacer()
        }
        .padding(.horizontal, 24)
        .sheet(isPresented: $viewModel.isQRScannerPresented) {
            NavigationStack {
                QRCodeScannerView { code in
                    Task { await viewModel.handleScannedPairingCode(code) }
                }
                .ignoresSafeArea()
                .navigationTitle("Scan pairing code")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            viewModel.dismissQRScanner()
                        }
                    }
                }
            }
        }
        .alert(
            "Couldn’t pair",
            isPresented: Binding(
                get: { viewModel.pairingError != nil },
                set: { if !$0 { viewModel.pairingError = nil } }
            )
        ) {
            Button("OK", role: .cancel) {
                viewModel.pairingError = nil
            }
        } message: {
            Text(viewModel.pairingError ?? "")
        }
    }
}

#Preview {
    ScanQRCodeView(viewModel: HomeViewModel())
}
