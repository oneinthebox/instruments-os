import SwiftUI

protocol DemoBug {
    var title: String { get }
    var description: String { get }
    var trackName: String { get }
    func trigger()
    func stop()
}

struct BugView: View {
    let bug: DemoBug
    @State private var isRunning = false
    @State private var statusText = "Ready"

    var body: some View {
        VStack(spacing: 24) {
            Text(bug.title)
                .font(.title.bold())

            Text(bug.description)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Text("Visible in: \(bug.trackName)")
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.purple.opacity(0.2))
                .clipShape(Capsule())

            Button(isRunning ? "Stop" : "Trigger Bug") {
                if isRunning {
                    bug.stop()
                    statusText = "Stopped"
                } else {
                    statusText = "Running..."
                    bug.trigger()
                }
                isRunning.toggle()
            }
            .buttonStyle(.borderedProminent)
            .tint(isRunning ? .red : .purple)

            Text(statusText)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
