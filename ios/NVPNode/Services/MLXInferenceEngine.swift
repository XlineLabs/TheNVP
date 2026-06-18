import Foundation
import MLX
import MLXLLM
import MLXLMCommon

enum ModelLoadError: Error, LocalizedError {
    case registrationFailed
    case loadFailed(String)
    case notLoaded

    var errorDescription: String? {
        switch self {
        case .registrationFailed: return "Failed to register Gemma 4"
        case .loadFailed(let msg): return "Model load failed: \(msg)"
        case .notLoaded: return "Inference engine not loaded"
        }
    }
}

@MainActor
final class MLXInferenceEngine: InferenceEngine {
    private var container: ModelContainer?
    private var currentModelId: String?
    private var isGemma4Registered = false

    var isLoaded: Bool { container != nil }

    private var progressHandler: ((Double) -> Void)?

    func setProgressHandler(_ handler: @escaping (Double) -> Void) {
        self.progressHandler = handler
    }

    func load(modelDir: URL?) async throws {
        if container != nil && currentModelId == Config.workerModelId { return }

        container = nil
        currentModelId = nil
        MLX.GPU.set(cacheLimit: 20 * 1024 * 1024)

        let modelId = Config.workerModelId

        if modelId == "gemma_4_e2b_it_4bit" || modelId.hasPrefix("gemma4") {
            if !isGemma4Registered {
                await registerGemma4()
                isGemma4Registered = true
            }

            progressHandler?(0.1)

            let configuration = ModelConfiguration(
                id: "mlx-community/gemma-4-e2b-it-4bit",
                computeLimit: .limitStorage(2 * 1024 * 1024 * 1024)
            )

            do {
                progressHandler?(0.3)
                container = try await LLMModelFactory.shared.loadContainer(configuration: configuration)
                progressHandler?(1.0)
                currentModelId = modelId
                nvpLog(.success, "Gemma 4 loaded successfully")
            } catch {
                throw ModelLoadError.loadFailed(error.localizedDescription)
            }
        } else {
            let configuration: ModelConfiguration
            switch modelId {
            case "gemma3n_e2b":
                configuration = LLMRegistry.gemma3n_E2B_it_lm_4bit
            case "qwen2_5_0_5b":
                configuration = ModelConfiguration(id: "mlx-community/Qwen2.5-0.5B-Instruct-4bit")
            default:
                configuration = LLMRegistry.gemma3_1B_qat_4bit
            }

            do {
                progressHandler?(0.3)
                container = try await LLMModelFactory.shared.loadContainer(configuration: configuration)
                progressHandler?(1.0)
                currentModelId = modelId
                nvpLog(.success, "Model \(modelId) loaded")
            } catch {
                throw ModelLoadError.loadFailed(error.localizedDescription)
            }
        }
    }

    private func registerGemma4() async {
        do {
            await Gemma4Registration.registerIfNeeded().value
            nvpLog(.info, "Gemma 4 registered with MLX")
        } catch {
            nvpLog(.warn, "Gemma 4 registration failed: \(error)")
        }
    }

    func generate(prompt: String, maxTokens: Int) async throws -> GenResult {
        guard let container else { throw ModelLoadError.notLoaded }

        let start = Date()
        let session = ChatSession(container, generateParameters: GenerateParameters(temperature: 0))

        do {
            let text = try await session.respond(to: prompt)
            let ms = Int(Date().timeIntervalSince(start) * 1000)
            return GenResult(text: text, tokensOut: max(1, text.count / 4), latencyMs: ms)
        } catch {
            nvpLog(.error, "Generation failed: \(error)")
            throw ModelLoadError.loadFailed(error.localizedDescription)
        }
    }

    func unload() {
        container = nil
        currentModelId = nil
        nvpLog(.info, "Model unloaded")
    }
}