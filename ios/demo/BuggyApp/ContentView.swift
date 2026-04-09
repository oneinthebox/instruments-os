import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            BugView(bug: MainThreadBlocker())
                .tabItem { Label("CPU Block", systemImage: "cpu") }
            BugView(bug: MemoryLeaker())
                .tabItem { Label("Mem Leak", systemImage: "memorychip") }
            BugView(bug: HitchGenerator())
                .tabItem { Label("Hitches", systemImage: "tortoise") }
            BugView(bug: NetworkSpammer())
                .tabItem { Label("Network", systemImage: "network") }
            BugView(bug: MLHog())
                .tabItem { Label("ML/GPU", systemImage: "brain") }
        }
        .preferredColorScheme(.dark)
    }
}
