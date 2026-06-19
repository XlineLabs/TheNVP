import AppKit
import MLXLLM
import MLXLMCommon
import Gemma4SwiftCore

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var api: APIClient
    private let engine: InferenceEngine = MLXInferenceEngine()
    private var loop: WorkerLoop?
    private var statusItem: NSStatusItem?
    private var heartbeatTask: Task<Void, Never>?

    init() {
        let key = KeychainStore.get(KeychainStore.apiKeyKey)
        api = APIClient(baseURL: Config.coordinatorURL, apiKey: key)
        super.init()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusItem()
        updateStatusItem("Starting")

        print("[NVP Node] Mac worker starting...")
        print("[NVP Node] Coordinator: \(Config.coordinatorURL)")
        print("[NVP Node] Recommended model: \(Config.effectiveModelId)")

        let workerId = KeychainStore.get(KeychainStore.workerIdKey)
        let apiKey = KeychainStore.get(KeychainStore.apiKeyKey)
        let isRegistered = (apiKey != nil && workerId != nil)

        if isRegistered {
            print("[NVP Node] Worker registered (ID: \(workerId ?? "unknown"))")
            startWorkerLoop()
        } else {
            print("[NVP Node] Not registered. Use the iOS app to register this worker.")
            print("[NVP Node] Or create a worker key and run registration.")
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        heartbeatTask?.cancel()
        Task { await loop?.stop() }
    }

    private func startWorkerLoop() {
        let loop = WorkerLoop(api: api, engine: engine, models: Config.modelCaps)
        self.loop = loop
        updateStatusItem("Loading model")

        if let mlxEngine = engine as? MLXInferenceEngine {
            mlxEngine.setProgressHandler { [weak self] progress in
                print("[NVP Node] Model load progress: \(Int(progress * 100))%")
                self?.updateStatusItem("Loading \(Int(progress * 100))%")
            }
        }

        Task {
            await Gemma4Registration.registerIfNeeded().value
            print("[NVP Node] Gemma 4 registered with MLX")

            await loop.start(
                shouldRun: { [weak self] in
                    await MainActor.run { self?.canWork ?? false }
                },
                onStatus: { [weak self] msg in
                    print("[NVP Node] Status: \(msg)")
                    self?.updateStatusItem(msg)
                },
                onActivity: { act in
                    print("[NVP Node] Activity: \(act)")
                },
                onJob: { outcome in
                    if outcome.accepted {
                        print("[NVP Node] Job accepted! Earned \(outcome.credited) credits")
                    }
                },
                onError: { [weak self] msg in
                    print("[NVP Node] Error: \(msg)")
                    self?.updateStatusItem("Error")
                }
            )
        }

        startHeartbeat()
    }

    private func startHeartbeat() {
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                let success = await self?.api.heartbeat() ?? false
                if !success {
                    print("[NVP Node] Heartbeat failed")
                }
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
    }

    private var canWork: Bool { true }

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem?.button {
            button.title = "NVP: Starting"
        }
    }

    private func updateStatusItem(_ status: String) {
        DispatchQueue.main.async { [weak self] in
            self?.statusItem?.button?.title = "NVP: \(status)"
        }
    }
}