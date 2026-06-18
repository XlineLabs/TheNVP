import Foundation

struct JobOutcome {
    let accepted: Bool
    let credited: Double
    let balance: Double
    let latencyMs: Int
}

/// Live worker phase, for the animated network/activity view.
enum WorkerActivity: String, Sendable {
    case idle
    case loadingModel
    case waiting
    case receivedJob
    case inferring
    case submitting
}

/// Drives the worker lifecycle: next → infer → submit, while allowed to run.
/// Stops cleanly when toggled off or the device can't work (background/heat).
actor WorkerLoop {
    private let api: APIClient
    private let engine: InferenceEngine
    private let models: [String]
    private var task: Task<Void, Never>?

    init(api: APIClient, engine: InferenceEngine, models: [String]) {
        self.api = api
        self.engine = engine
        self.models = models
    }

    /// - shouldRun: evaluated each iteration (foreground + thermal ok).
    /// - onStatus: lifecycle/status updates for the UI (e.g. "Loading model…").
    /// - onJob: called after each processed job with the outcome.
    /// - onError: called on transient errors (kept non-fatal).
    func start(
        shouldRun: @escaping @Sendable () async -> Bool,
        onStatus: @escaping @Sendable (String) async -> Void,
        onActivity: @escaping @Sendable (WorkerActivity) async -> Void,
        onJob: @escaping @Sendable (JobOutcome) async -> Void,
        onError: @escaping @Sendable (String) async -> Void
    ) {
        guard task == nil else { return }
        task = Task { [api, engine, models] in
            while !Task.isCancelled {
                if await !shouldRun() {
                    await onActivity(.idle)
                    try? await Task.sleep(nanoseconds: 1_000_000_000)
                    continue
                }

                // Lazy-load the model (first run downloads it, ~hundreds of MB).
                // Surface the real error instead of silently swallowing it.
                if !engine.isLoaded {
                    do {
                        await onActivity(.loadingModel)
                        await onStatus("Loading model… (first run downloads it)")
                        nvpLog(.info, "Loading on-device model…")
                        try await engine.load(modelDir: nil)
                        await onStatus("working")
                        nvpLog(.success, "Model loaded — ready to work")
                    } catch is CancellationError {
                        return
                    } catch {
                        await onError("Model load failed: \(error.localizedDescription)")
                        nvpLog(.error, "Model load failed: \(error.localizedDescription)")
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        continue
                    }
                }

                do {
                    await onActivity(.waiting)
                    guard let job = try await api.nextJob(models: models) else {
                        continue // 204 — re-poll immediately
                    }
                    await onActivity(.receivedJob)
                    nvpLog(.info, "Job \(job.jobId) received (\(job.model))")
                    let maxTokens = job.params?.maxTokens ?? 128
                    await onActivity(.inferring)
                    let gen = try await engine.generate(prompt: job.prompt, maxTokens: maxTokens)
                    nvpLog(.info, "Inferred \(gen.tokensOut) tok in \(gen.latencyMs) ms")
                    await onActivity(.submitting)
                    let res = try await api.submitResult(
                        jobId: job.jobId,
                        output: gen.text,
                        latencyMs: gen.latencyMs,
                        tokensOut: gen.tokensOut
                    )
                    if res.accepted {
                        nvpLog(.success, "Accepted +$\(String(format: "%.6f", res.credited)) · bal $\(String(format: "%.4f", res.balance))")
                    } else {
                        nvpLog(.warn, "Rejected: \(res.reason ?? "verification failed")")
                    }
                    await onJob(JobOutcome(
                        accepted: res.accepted,
                        credited: res.credited,
                        balance: res.balance,
                        latencyMs: gen.latencyMs
                    ))
                } catch is CancellationError {
                    return
                } catch {
                    await onError(error.localizedDescription)
                    nvpLog(.error, error.localizedDescription)
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                }
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
        engine.unload()
    }
}
