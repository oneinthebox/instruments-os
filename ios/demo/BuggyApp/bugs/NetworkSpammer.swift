import Foundation

class NetworkSpammer: DemoBug {
    let title = "Network Spammer"
    let description = "Fires 100 concurrent HTTP requests, saturating the network subsystem."
    let trackName = "Signpost Track"

    func trigger() {
        for i in 0..<100 {
            let url = URL(string: "https://httpbin.org/get?req=\(i)")!
            URLSession.shared.dataTask(with: url) { data, response, error in
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                print("[Bug] Request \(i) completed: \(status)")
            }.resume()
        }
        print("[Bug] Fired 100 concurrent requests")
    }

    func stop() {}
}
