import Foundation

class MemoryLeaker: DemoBug {
    let title = "Memory Leaker"
    let description = "Creates a timer that captures self strongly, leaking ~1MB per second."
    let trackName = "Memory Track"

    private var leakedData: [Data] = []
    private var timer: Timer?

    func trigger() {
        // Timer retains self via closure — intentional retain cycle
        timer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [self] _ in
            // Allocate 100KB each tick = ~1MB/sec
            let chunk = Data(repeating: 0xFF, count: 100_000)
            self.leakedData.append(chunk)
            if self.leakedData.count % 10 == 0 {
                let mb = self.leakedData.count * 100_000 / 1_000_000
                print("[Bug] Leaked \(mb) MB")
            }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        leakedData.removeAll()
    }
}
