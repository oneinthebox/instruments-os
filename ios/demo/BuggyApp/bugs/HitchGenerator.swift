import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

class HitchGenerator: DemoBug {
    let title = "Hitch Generator"
    let description = "Applies expensive CIFilter processing synchronously during scrolling, causing frame drops."
    let trackName = "Hitch Track"

    private var isActive = false

    func trigger() {
        isActive = true
        // Run heavy processing on main thread in a loop
        DispatchQueue.main.async { [self] in
            guard isActive else { return }
            for i in 0..<20 {
                autoreleasepool {
                    let size = CGSize(width: 1000, height: 1000)
                    let renderer = UIGraphicsImageRenderer(size: size)
                    let image = renderer.image { ctx in
                        UIColor.purple.setFill()
                        ctx.fill(CGRect(origin: .zero, size: size))
                    }
                    let ciImage = CIImage(image: image)!
                    let filter = CIFilter.gaussianBlur()
                    filter.inputImage = ciImage
                    filter.radius = 50
                    let context = CIContext()
                    let _ = context.createCGImage(filter.outputImage!, from: ciImage.extent)
                    print("[Bug] Processed heavy image \(i)")
                }
                // Brief pause to let run loop process
                Thread.sleep(forTimeInterval: 0.05)
            }
        }
    }

    func stop() {
        isActive = false
    }
}
