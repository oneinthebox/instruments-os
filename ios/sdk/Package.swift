// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InstrumentsOS",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "InstrumentsOS", targets: ["InstrumentsOS"]),
    ],
    targets: [
        // C / Objective-C core: ring buffer, event types, CPU sampler, transport
        .target(
            name: "CInstrumentsOS",
            path: "Sources/InstrumentsOS",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("Core"),
                .headerSearchPath("Transport"),
            ]
        ),
        // Public Swift facade that re-exports the C layer
        .target(
            name: "InstrumentsOS",
            dependencies: ["CInstrumentsOS"],
            path: "Sources/InstrumentsOSSwift"
        ),
        .testTarget(
            name: "InstrumentsOSTests",
            dependencies: ["InstrumentsOS"]
        ),
    ]
)
