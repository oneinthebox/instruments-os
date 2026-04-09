import Foundation
import Accelerate

class MLHog: DemoBug {
    let title = "ML/GPU Hog"
    let description = "Runs heavy matrix multiplication on the main thread, simulating on-device ML inference load."
    let trackName = "GPU Track + Hitch Track"

    private var isActive = false

    func trigger() {
        isActive = true
        // Heavy matrix multiplication on main thread
        DispatchQueue.main.async { [self] in
            let size = 512
            let count = size * size
            var a = [Float](repeating: 0, count: count)
            var b = [Float](repeating: 0, count: count)
            var c = [Float](repeating: 0, count: count)

            // Fill with random data
            for i in 0..<count {
                a[i] = Float.random(in: -1...1)
                b[i] = Float.random(in: -1...1)
            }

            for iter in 0..<10 {
                guard self.isActive else { break }
                // BLAS matrix multiply — this is HEAVY
                cblas_sgemm(
                    CblasRowMajor, CblasNoTrans, CblasNoTrans,
                    Int32(size), Int32(size), Int32(size),
                    1.0, &a, Int32(size),
                    &b, Int32(size),
                    0.0, &c, Int32(size)
                )
                print("[Bug] Matrix multiply iteration \(iter) done")
                // Copy result back for next iteration
                a = c
            }
            print("[Bug] ML simulation complete")
        }
    }

    func stop() {
        isActive = false
    }
}
