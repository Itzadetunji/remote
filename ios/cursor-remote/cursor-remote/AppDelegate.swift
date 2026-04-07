import UIKit
import UserNotifications

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task {
            await Self.requestNotificationsAndRegister(application: application)
        }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in
            PushState.shared.deviceToken = hex
            if PushState.shared.connectedComputerName == nil {
                PushState.shared.statusMessage =
                    "Push token registered. Scan pairing QR to connect."
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in
            PushState.shared.statusMessage =
                "Push registration failed: \(error.localizedDescription)"
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    private static func requestNotificationsAndRegister(application: UIApplication) async {
        let center = UNUserNotificationCenter.current()
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .sound, .badge])
            await MainActor.run {
                if granted {
                    application.registerForRemoteNotifications()
                } else {
                    PushState.shared.statusMessage =
                        "Notifications denied. Enable them in Settings to pair and receive alerts."
                }
            }
        } catch {
            await MainActor.run {
                PushState.shared.statusMessage = "Could not request notification permission."
            }
        }
    }
}
