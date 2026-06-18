import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var app: AppState
    @State private var busy = false
    @State private var showRestore = false
    @State private var restoreText = ""

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Text("NVP")
                .font(.system(size: 46, weight: .heavy, design: .rounded))
                .foregroundColor(Theme.gold)
            Text("Earn by running AI on your iPhone")
                .font(.title3).bold()
                .foregroundColor(Theme.text)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 14) {
                bullet("📱", "Your iPhone runs a small AI model on-device and answers jobs from the network.")
                bullet("💵", "You get paid real money for every verified answer.")
                bullet("🔌", "Works while the app is open — best while charging. Not passive 24/7.")
            }
            .card()
            .padding(.horizontal)

            if let err = app.errorMessage {
                Text(err).foregroundColor(Theme.red).font(.footnote).padding(.horizontal)
            }

            VStack(spacing: 10) {
                Button {
                    busy = true
                    Task { await app.register(); busy = false }
                } label: {
                    Text(busy ? "Setting up…" : "Get started")
                        .bold().frame(maxWidth: .infinity).padding()
                        .background(Theme.accent).foregroundColor(Theme.onAccent)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(busy)

                Button("I already have an account — restore") { showRestore = true }
                    .font(.footnote).foregroundColor(Theme.gold)
            }
            .padding(.horizontal)

            Text("Coordinator: \(Config.coordinatorURL)")
                .font(.caption2).foregroundColor(Theme.muted)
            Spacer()
        }
        .sheet(isPresented: $showRestore) {
            RestoreSheet(text: $restoreText) {
                let ok = await app.restore(from: restoreText)
                if ok { showRestore = false }
                return ok
            }
        }
    }

    private func bullet(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(icon)
            Text(text).foregroundColor(Theme.text).font(.callout)
        }
    }
}

private struct RestoreSheet: View {
    @Binding var text: String
    let onRestore: () async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("Paste your recovery key file contents (it contains your api_key).")
                    .font(.callout).foregroundColor(Theme.muted)
                TextEditor(text: $text)
                    .frame(height: 160)
                    .padding(8)
                    .background(Theme.elev)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.border))
                Button {
                    busy = true
                    Task { _ = await onRestore(); busy = false }
                } label: {
                    Text(busy ? "Restoring…" : "Restore account")
                        .bold().frame(maxWidth: .infinity).padding()
                        .background(Theme.accent).foregroundColor(Theme.onAccent)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(busy || text.isEmpty)
                Spacer()
            }
            .padding()
            .background(Theme.bg)
            .navigationTitle("Restore")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}
