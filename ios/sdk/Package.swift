// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "InstrumentsOS",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "InstrumentsOS", targets: ["InstrumentsOS"]),
    ],
    targets: [
        .target(
            name: "InstrumentsOS",
            path: "Sources/InstrumentsOS",
            publicHeadersPath: "include",
            cSettings: [
                .headerSearchPath("Core"),
                .headerSearchPath("Transport"),
            ]
        ),
        .testTarget(
            name: "InstrumentsOSTests",
            dependencies: ["InstrumentsOS"]
        ),
    ]
)
