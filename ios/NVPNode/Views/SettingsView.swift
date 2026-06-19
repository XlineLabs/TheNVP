import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var app: AppState
    @State private var coordinatorURL = Config.coordinatorURL
    @State private var saved = false
    @State private var shareItems: [Any] = []
    @State private var showShare = false
    @State private var email = ""
    @State private var password = ""
    @State private var linking = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    modelSelectionSection
                    downloadStatusSection
                    recoveryKeySection
                    linkAccountSection
                    coordinatorURLSection
                    deviceSection
                    signOutButton
                    if let err = app.errorMessage {
                        errorSection(err)
                    }
                }
                .padding()
            }
            .background(Theme.bg)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .task { try? await app.loadModels() }
            .sheet(isPresented: $showShare) { ShareSheet(items: shareItems) }
        }
    }

    private var modelSelectionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("On-device model").font(.headline).foregroundColor(Theme.text)
            Text("Choose what your iPhone runs. Price = what you earn per job.")
                .font(.caption).foregroundColor(Theme.muted)

            Button { app.setWorkerModel("auto") } label: {
                HStack(spacing: 10) {
                    Image(systemName: Config.workerModelId == "auto" ? "largecircle.fill.circle" : "circle")
                        .foregroundColor(Config.workerModelId == "auto" ? Theme.green : Theme.muted)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Automatic (recommended)").foregroundColor(Theme.text).font(.callout)
                        Text("Picks best model for your device → \(Config.effectiveModelId)")
                            .font(.caption2).foregroundColor(Theme.muted)
                    }
                    Spacer()
                    Image(systemName: "wand.and.stars").foregroundColor(Theme.gold)
                }
                .padding(.vertical, 6)
            }
            Divider().background(Theme.border)

            ForEach(app.models) { m in
                let supported = Config.supportedOnDevice.contains(m.id)
                let selected = m.id == Config.workerModelId || (m.id == "auto" && Config.workerModelId == "auto")
                let modelSize = Config.modelSizeGB(m.id)
                let isDownloading = app.isModelLoading && app.selectedModelId == m.id
                let isSelectedModel = Config.effectiveModelId == m.id

                Button {
                    if supported { app.setWorkerModel(m.id) }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                            .foregroundColor(selected ? Theme.green : Theme.muted)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(m.name).foregroundColor(Theme.text).font(.callout)
                                if modelSize != "—" {
                                    Text(modelSize)
                                        .font(.caption2)
                                        .foregroundColor(Theme.gold)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Theme.gold.opacity(0.15))
                                        .clipShape(Capsule())
                                }
                            }
                            HStack(spacing: 4) {
                                if supported {
                                    if isSelectedModel && app.isModelLoaded {
                                        Label("Loaded", systemImage: "checkmark.circle.fill")
                                            .font(.caption2)
                                            .foregroundColor(Theme.green)
                                    } else if isDownloading {
                                        Label("Downloading...", systemImage: "arrow.down.circle")
                                            .font(.caption2)
                                            .foregroundColor(Theme.gold)
                                    } else {
                                        Text("Runs on this iPhone")
                                            .font(.caption2)
                                            .foregroundColor(Theme.muted)
                                    }
                                } else {
                                    Text("Not runnable on iOS yet")
                                        .font(.caption2)
                                        .foregroundColor(Theme.red)
                                }
                            }
                        }
                        Spacer()
                        Text("\(Format.usd(m.creditRate))/job")
                            .font(.caption).foregroundColor(Theme.gold)
                    }
                    .padding(.vertical, 6)
                    .opacity(supported ? 1 : 0.5)
                }
                .disabled(!supported)
                Divider().background(Theme.border)
            }

            if app.models.isEmpty {
                Text("Loading models…").font(.caption).foregroundColor(Theme.muted)
            }
        }
        .card()
    }

    private var downloadStatusSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Download Status").font(.headline).foregroundColor(Theme.text)

            if app.isModelLoading {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "arrow.down.circle.fill")
                            .foregroundColor(Theme.gold)
                        Text("Downloading \(app.selectedModelId ?? "model")...")
                            .font(.callout).foregroundColor(Theme.text)
                        Spacer()
                        Text("\(Int(app.modelLoadProgress * 100))%")
                            .font(.caption).foregroundColor(Theme.gold)
                    }
                    ProgressView(value: app.modelLoadProgress)
                        .tint(Theme.gold)
                    Text("Don't close the app during download")
                        .font(.caption2).foregroundColor(Theme.muted)
                }
            } else if app.isModelLoaded {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Theme.green)
                    Text("Model ready: \(Config.effectiveModelId)")
                        .font(.callout).foregroundColor(Theme.text)
                    Spacer()
                }
            } else {
                HStack {
                    Image(systemName: "arrow.down.circle")
                        .foregroundColor(Theme.muted)
                    Text("No model loaded")
                        .font(.callout).foregroundColor(Theme.muted)
                    Spacer()
                }
            }

            let cached = getCachedModels()
            if !cached.isEmpty {
                Divider().background(Color.white.opacity(0.06))
                Text("Cached Models").font(.subheadline).foregroundColor(Theme.muted)
                ForEach(cached, id: \.self) { model in
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundColor(Theme.green)
                            .font(.caption)
                        Text(model)
                            .font(.caption).foregroundColor(Theme.text)
                        Spacer()
                        Text(Config.modelSizeGB(model))
                            .font(.caption2).foregroundColor(Theme.muted)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .card()
    }

    private var recoveryKeySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recovery key").font(.headline).foregroundColor(Theme.text)
            Text("Download a file with your recovery key.")
                .font(.caption).foregroundColor(Theme.muted)

            Button {
                if let s = app.recoveryString, let url = writeRecoveryFile(s) {
                    shareItems = [url]
                    showShare = true
                }
            } label: {
                Label("Download recovery key", systemImage: "key.fill")
                    .frame(maxWidth: .infinity).padding()
                    .background(Theme.accent).foregroundColor(Theme.onAccent)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .card()
    }

    private var linkAccountSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Chatbot account").font(.headline).foregroundColor(Theme.text)
            if let linked = app.linkedEmail {
                Label("Linked to \(linked)", systemImage: "checkmark.seal.fill")
                    .foregroundColor(Theme.green).font(.callout)
                Text("Your earnings show up in the chatbot's Worker status.")
                    .font(.caption).foregroundColor(Theme.muted)
            } else {
                Text("Sign in with your chatbot email to see earnings on the website.")
                    .font(.caption).foregroundColor(Theme.muted)
                TextField("Email", text: $email)
                    .textInputAutocapitalization(.never).keyboardType(.emailAddress)
                    .padding().background(Theme.elev).clipShape(RoundedRectangle(cornerRadius: 8))
                    .foregroundColor(Theme.text)
                SecureField("Password", text: $password)
                    .padding().background(Theme.elev).clipShape(RoundedRectangle(cornerRadius: 8))
                    .foregroundColor(Theme.text)
                Button {
                    linking = true
                    Task { _ = await app.linkAccount(email: email, password: password); linking = false }
                } label: {
                    Text(linking ? "Linking…" : "Link account")
                        .bold().frame(maxWidth: .infinity).padding()
                        .background(Theme.accent).foregroundColor(Theme.onAccent)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(linking || email.isEmpty || password.isEmpty)
            }
        }
        .card()
    }

    private var coordinatorURLSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Coordinator URL").font(.headline).foregroundColor(Theme.text)
            TextField("https://…", text: $coordinatorURL)
                .textInputAutocapitalization(.never).keyboardType(.URL)
                .padding().background(Theme.elev).clipShape(RoundedRectangle(cornerRadius: 8))
                .foregroundColor(Theme.text)
            Button("Save") {
                Config.coordinatorURL = coordinatorURL.trimmingCharacters(in: .whitespaces)
                app.rebuildClient()
                saved = true
            }
            .foregroundColor(Theme.gold)
            if saved { Text("Saved.").font(.caption).foregroundColor(Theme.green) }
        }
        .card()
    }

    private var deviceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Device").font(.headline).foregroundColor(Theme.text)
            row("Worker ID", app.workerId ?? "—")
            row("Model", Config.effectiveModelId)
            row("Storage", Config.modelSizeGB(Config.effectiveModelId))
            row("Charging", app.deviceState.isCharging ? "Yes" : "No")
        }
        .card()
    }

    private var signOutButton: some View {
        Button(role: .destructive) { app.signOut() } label: {
            Text("Sign out / reset device")
                .frame(maxWidth: .infinity).padding()
                .background(Theme.elev2).foregroundColor(Theme.red)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private func errorSection(_ err: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(Theme.red)
            Text(err).font(.caption).foregroundColor(Theme.red)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundColor(Theme.muted)
            Spacer()
            Text(value).foregroundColor(Theme.text).font(.callout).lineLimit(1).truncationMode(.middle)
        }
    }

    private func getCachedModels() -> [String] {
        let fileManager = FileManager.default
        guard let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return []
        }
        let mlxCache = cacheDir.appendingPathComponent("mlx")
        guard fileManager.fileExists(atPath: mlxCache.path) else { return [] }
        do {
            let contents = try fileManager.contentsOfDirectory(atPath: mlxCache.path)
            return contents.filter { $0.contains("gemma") || $0.contains("qwen") || $0.contains("mlx") }
        } catch {
            return []
        }
    }
}