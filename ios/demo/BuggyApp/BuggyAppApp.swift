import SwiftUI

@main
struct BuggyAppApp: App {
    init() {
        // In a real setup, you'd import InstrumentsOS and call:
        // InstrumentsOS.configure(host: "YOUR_MAC_IP", port: 8765)
        // InstrumentsOS.startProfiling()
        // For now, just print a message
        print("[BuggyApp] Ready — connect InstrumentsOS to profile")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
