import Foundation
import Combine
import CryptoKit
import UIKit

@MainActor
final class AppState: ObservableObject {
    private var cancellables = Set<AnyCancellable>()
    // Registration
    @Published var workerId: String?
    @Published var isRegistered = false

    // Worker runtime
    @Published var isWorker = false
    @Published var status = "idle"
    @Published var lastLatencyMs = 0
    @Published var jobsToday = 0
    @Published var creditsToday = 0.0
    @Published var errorMessage: String?

    // Earnings
    @Published var balance = 0.0
    @Published var jobsDone = 0
    @Published var ledger: [LedgerEntry] = []
    @Published var payoutsList: [Payout] = []

    // Catalog
    @Published var models: [ModelDTO] = []

    // Linked chatbot account (email), if any.
    @Published var linkedEmail: String? = UserDefaults.standard.string(forKey: "linked_email")

    // Live network + activity (for the animated Network view)
    @Published var networkOnline = 0
    @Published var networkTotal = 0
    @Published var networkTops = 0
    @Published var liveTokps = 0.0
    @Published var activity: WorkerActivity = .idle

    // Model loading progress
    @Published var modelLoadProgress: Double = 0.0
    @Published var isModelLoading: Bool = false

    private var statsTask: Task<Void, Never>?
    private var heartbeatTask: Task<Void, Never>?

    let deviceState = DeviceState()
    private var api: APIClient
    // Real on-device inference (MLX). Swap to StubInferenceEngine() only to test
    // the loop without loading a model.
    private let engine: InferenceEngine = MLXInferenceEngine()
    private var loop: WorkerLoop?

    init() {
        let key = KeychainStore.get(KeychainStore.apiKeyKey)
        api = APIClient(baseURL: Config.coordinatorURL, apiKey: key)
        workerId = KeychainStore.get(KeychainStore.workerIdKey)
        isRegistered = (key != nil && workerId != nil)

        // Re-render views observing AppState when device conditions change
        // (charging / thermal / foreground).
        deviceState.objectWillChange
            .sink { [weak self] in self?.objectWillChange.send() }
            .store(in: &cancellables)

        startStatsPolling()
        if isRegistered { Task { try? await loadModels() } }
    }

    /// Change the on-device model the worker runs. Reloads the engine on the
    /// next loop iteration and advertises the new model to the coordinator.
    func setWorkerModel(_ id: String) {
        Config.workerModelId = id
        engine.unload()
        nvpLog(.info, "Switched on-device model to \(id)")
        objectWillChange.send()
    }

    /// Poll public network stats so the Network view always shows live counts.
    private func startStatsPolling() {
        statsTask = Task { [weak self] in
            while !Task.isCancelled {
                if let s = try? await self?.api.stats() {
                    await MainActor.run {
                        guard let self else { return }
                        self.networkOnline = s.devicesOnline
                        self.networkTotal = s.devicesTotal
                        self.networkTops = s.combinedTops
                        self.liveTokps = s.liveTokensPerSec
                    }
                }
                try? await Task.sleep(nanoseconds: 4_000_000_000)
            }
        }
    }

    /// Rebuild the API client (e.g. after the coordinator URL changes in Settings).
    func rebuildClient() {
        api = APIClient(baseURL: Config.coordinatorURL, apiKey: KeychainStore.get(KeychainStore.apiKeyKey))
    }

    // MARK: Registration

    func register() async {
        errorMessage = nil
        do {
            let pubkey = devicePublicKey()
            let res = try await api.register(devicePubkey: pubkey)
            KeychainStore.set(res.apiKey, for: KeychainStore.apiKeyKey)
            KeychainStore.set(res.workerId, for: KeychainStore.workerIdKey)
            api.setApiKey(res.apiKey)
            workerId = res.workerId
            isRegistered = true
            nvpLog(.success, "Registered worker \(res.workerId)")
            try? await loadModels()
        } catch {
            errorMessage = error.localizedDescription
            nvpLog(.error, "Registration failed: \(error.localizedDescription)")
        }
    }

    private func devicePublicKey() -> String {
        if let raw = KeychainStore.get(KeychainStore.devicePrivKey),
           let data = Data(base64Encoded: raw),
           let priv = try? Curve25519.Signing.PrivateKey(rawRepresentation: data) {
            return "ed25519:" + priv.publicKey.rawRepresentation.base64EncodedString()
        }
        let priv = Curve25519.Signing.PrivateKey()
        KeychainStore.set(priv.rawRepresentation.base64EncodedString(), for: KeychainStore.devicePrivKey)
        return "ed25519:" + priv.publicKey.rawRepresentation.base64EncodedString()
    }

    func loadModels() async throws {
        models = try await api.models()
    }

    // MARK: Worker toggle

    func setWorker(_ on: Bool) {
        isWorker = on
        // Keep the screen awake while working so the (large) model download and
        // inference aren't cancelled by auto-lock / backgrounding.
        UIApplication.shared.isIdleTimerDisabled = on
        nvpLog(.info, on ? "Worker turned ON (screen kept awake)" : "Worker turned OFF")
        if on { startLoop() } else { Task { await stopLoop() } }
    }

    private func startLoop() {
        let loop = WorkerLoop(api: api, engine: engine, models: Config.modelCaps)
        self.loop = loop
        status = "working"

        // Set up model loading progress tracking
        if let mlxEngine = engine as? MLXInferenceEngine {
            mlxEngine.setProgressHandler { [weak self] progress in
                Task { @MainActor in
                    self?.modelLoadProgress = progress
                    if progress > 0 && progress < 1 {
                        self?.isModelLoading = true
                    } else {
                        self?.isModelLoading = false
                    }
                }
            }
        }

        Task {
            await loop.start(
                shouldRun: { [weak self] in
                    await MainActor.run { (self?.deviceState.canWork ?? false) && (self?.isWorker ?? false) }
                },
                onStatus: { [weak self] msg in await MainActor.run { self?.status = msg } },
                onActivity: { [weak self] act in await MainActor.run { self?.activity = act } },
                onJob: { [weak self] outcome in await self?.handleJob(outcome) },
                onError: { [weak self] msg in await MainActor.run { self?.errorMessage = msg } }
            )
        }
        // Presence heartbeat (keeps us "online" even while the model downloads).
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                let success = await self?.api.heartbeat() ?? false
                if !success {
                    nvpLog(.warn, "Heartbeat failed, will retry")
                }
                try? await Task.sleep(nanoseconds: 15_000_000_000) // 15 seconds
            }
        }
    }

    private func stopLoop() async {
        heartbeatTask?.cancel()
        heartbeatTask = nil
        await loop?.stop()
        loop = nil
        status = "idle"
        activity = .idle
    }

    private func handleJob(_ o: JobOutcome) {
        lastLatencyMs = o.latencyMs
        if o.accepted {
            jobsToday += 1
            creditsToday += o.credited
            balance = o.balance
        }
    }

    // MARK: Earnings

    func refreshEarnings() async {
        do {
            let b = try await api.balance()
            balance = b.balance
            jobsDone = b.jobsDone
            ledger = try await api.ledger()
            payoutsList = try await api.payouts()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func requestPayout(amount: Double) async -> Bool {
        do {
            _ = try await api.requestPayout(amount: amount)
            await refreshEarnings()
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    // MARK: Recovery key (reconnect on another device)

    /// Human-readable recovery file contents (contains the device API key).
    var recoveryString: String? {
        guard let key = KeychainStore.get(KeychainStore.apiKeyKey),
              let wid = KeychainStore.get(KeychainStore.workerIdKey) else { return nil }
        return """
        NVP NODE — RECOVERY KEY
        Keep this private. It reconnects your worker account (and earnings) on another device.

        worker_id=\(wid)
        api_key=\(key)
        """
    }

    /// Restore an account from a pasted/imported recovery key.
    func restore(from text: String) async -> Bool {
        errorMessage = nil
        func field(_ name: String) -> String? {
            for line in text.split(whereSeparator: { $0 == "\n" || $0 == "\r" }) {
                let s = line.trimmingCharacters(in: .whitespaces)
                if s.hasPrefix("\(name)=") { return String(s.dropFirst(name.count + 1)).trimmingCharacters(in: .whitespaces) }
            }
            return nil
        }
        let key = field("api_key") ?? (text.contains("nvp_live_") ? text.trimmingCharacters(in: .whitespacesAndNewlines) : nil)
        let wid = field("worker_id")
        guard let apiKey = key, apiKey.hasPrefix("nvp_live_") else {
            errorMessage = "Invalid recovery key"
            return false
        }
        KeychainStore.set(apiKey, for: KeychainStore.apiKeyKey)
        if let wid { KeychainStore.set(wid, for: KeychainStore.workerIdKey) }
        rebuildClient()
        // Validate by fetching balance.
        do {
            let b = try await api.balance()
            balance = b.balance
            jobsDone = b.jobsDone
            workerId = wid ?? KeychainStore.get(KeychainStore.workerIdKey)
            isRegistered = true
            nvpLog(.success, "Account restored from recovery key")
            return true
        } catch {
            errorMessage = "Recovery key not accepted by coordinator"
            KeychainStore.delete(KeychainStore.apiKeyKey)
            return false
        }
    }

    // MARK: Link to chatbot account

    func linkAccount(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            _ = try await api.link(email: email, password: password)
            linkedEmail = email
            UserDefaults.standard.set(email, forKey: "linked_email")
            nvpLog(.success, "Linked to chatbot account \(email)")
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func signOut() {
        KeychainStore.delete(KeychainStore.apiKeyKey)
        KeychainStore.delete(KeychainStore.workerIdKey)
        isRegistered = false
        workerId = nil
        isWorker = false
        linkedEmail = nil
        UserDefaults.standard.removeObject(forKey: "linked_email")
        UIApplication.shared.isIdleTimerDisabled = false
        Task { await stopLoop() }
    }
}
