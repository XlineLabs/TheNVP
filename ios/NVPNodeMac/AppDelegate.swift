import AppKit
import Combine

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var cancellables = Set<AnyCancellable>()
    private let deviceState = DeviceStateMac()
    private var api: APIClient
    private let engine: InferenceEngine = MLXInferenceEngine()
    private var loop: WorkerLoop?
    private var statusItem: NSStatusItem?
    private let key = KeychainStore.get(KeychainStore.apiKeyKey)

    init() {
        api = APIClient(baseURL: Config.coordinatorURL, apiKey: key)
        super.init()
        setupStatusItem()
        registerGemma4IfNeeded()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        print("[NVP Node] Mac worker starting...")

        let workerId = KeychainStore.get(KeychainStore.workerIdKey)
        let isRegistered = (key != nil && workerId != nil)

        if isRegistered {
            print("[NVP Node] Worker registered, starting loop...")
            startWorkerLoop()
        } else {
            print("[NVP Node] Not registered. Use the iOS app to register this worker.")
        }
    }

    private func registerGemma4IfNeeded() {
        Task {
            await Gemma4Registration.registerIfNeeded().value
            print("[NVP Node] Gemma 4 registered")
        }
    }

    private func startWorkerLoop() {
        let loop = WorkerLoop(api: api, engine: engine, models: Config.modelCaps)
        self.loop = loop

        if let mlxEngine = engine as? MLXInferenceEngine {
            mlxEngine.setProgressHandler { progress in
                print("[NVP Node] Model load progress: \(Int(progress * 100))%")
            }
        }

        Task {
            await loop.start(
                shouldRun: { [weak self] in
                    await MainActor.run { self?.deviceState.canWork ?? false }
                },
                onStatus: { msg in
                    print("[NVP Node] Status: \(msg)")
                    self.updateStatusItem(status: msg)
                },
                onActivity: { act in
                    print("[NVP Node] Activity: \(act)")
                },
                onJob: { outcome in
                    if outcome.accepted {
                        print("[NVP Node] Job accepted! Earned \(outcome.credited) credits")
                    }
                },
                onError: { msg in
                    print("[NVP Node] Error: \(msg)")
                }
            )
        }

        startHeartbeat()
    }

    private func startHeartbeat() {
        Task {
            while !Task.isCancelled {
                let success = await api.heartbeat() ?? false
                if !success {
                    print("[NVP Node] Heartbeat failed")
                }
                try? await Task.sleep(nanoseconds: 15_000_000_000)
            }
        }
    }

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem?.button {
            button.title = "NVP: Idle"
        }
    }

    private func updateStatusItem(status: String) {
        if let button = statusItem?.button {
            button.title = "NVP: \(status.capitalized)"
        }
    }
}

final class DeviceStateMac {
    var canWork: Bool { true }
    var isCharging: Bool { true }
}