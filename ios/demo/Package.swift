// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BuggyApp",
    platforms: [.iOS(.v17)],
    dependencies: [
        .package(path: "../sdk"),
    ],
    targets: [
        .executableTarget(
            name: "BuggyApp",
            dependencies: [
                .product(name: "InstrumentsOS", package: "sdk"),
            ],
            path: "BuggyApp"
        ),
    ]
)
