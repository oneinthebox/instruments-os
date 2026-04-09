import Foundation

class MainThreadBlocker: DemoBug {
    let title = "Main Thread Blocker"
    let description = "Makes a synchronous network request on the main thread, blocking UI for 2-3 seconds."
    let trackName = "CPU Track + Hitch Track"

    func trigger() {
        // Deliberately synchronous on main thread — DO NOT DO THIS IN REAL APPS
        let url = URL(string: "https://httpbin.org/delay/2")!
        let _ = try? Data(contentsOf: url)
        print("[Bug] Main thread blocked for ~2s")
    }

    func stop() {}
}
