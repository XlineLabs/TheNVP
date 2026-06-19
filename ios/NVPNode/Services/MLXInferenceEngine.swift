import Foundation
import MLX
import MLXLLM
import MLXLMCommon
import Gemma4SwiftCore

enum ModelLoadError: Error, LocalizedError {
    case registrationFailed(String)
    case loadFailed(String)
    case notLoaded

    var errorDescription: String? {
        switch self {
        case .registrationFailed(let msg): return "Gemma 4 registration failed: \(msg)"
        case .loadFailed(let msg): return "Model load failed: \(msg)"
        case .notLoaded: return "Inference engine not loaded"
        }
    }
}

final class MLXInferenceEngine: InferenceEngine {
    private var container: ModelContainer?
    private var currentModelId: String?
    var isLoaded: Bool { container != nil && currentModelId == Config.effectiveModelId }
    private var progressHandler: ((Double) -> Void)?

    func setProgressHandler(_ handler: @escaping (Double) -> Void) {
        self.progressHandler = handler
    }

    func load(modelDir: URL?) async throws {
        let modelId = Config.effectiveModelId

        if container != nil && currentModelId == modelId {
            return
        }

        container = nil
        currentModelId = nil

        progressHandler?(0.05)

        let isGemma4 = modelId == "gemma_4_e2b_it_4bit" || modelId.hasPrefix("gemma4")
        let configuration: ModelConfiguration

        if isGemma4 {
            do {
                progressHandler?(0.1)
                await Gemma4Registration.registerIfNeeded().value
                progressHandler?(0.15)
                configuration = ModelConfiguration(id: Gemma4SwiftCore.verifiedModelId)
            } catch {
                throw ModelLoadError.registrationFailed(error.localizedDescription)
            }
        } else {
            switch modelId {
            case "gemma3n_e2b":
                configuration = LLMRegistry.gemma3n_E2B_it_lm_4bit
            case "qwen2_5_0_5b":
                configuration = ModelConfiguration(id: "mlx-community/Qwen2.5-0.5B-Instruct-4bit")
            default:
                configuration = LLMRegistry.gemma3_1B_qat_4bit
            }
        }

        progressHandler?(0.2)

        do {
            container = try await LLMModelFactory.shared.loadContainer(configuration: configuration)
            currentModelId = modelId
            progressHandler?(1.0)
        } catch {
            throw ModelLoadError.loadFailed(error.localizedDescription)
        }
    }

    func generate(prompt: String, maxTokens: Int) async throws -> GenResult {
        guard let container else { throw ModelLoadError.notLoaded }

        let start = Date()
        let params = GenerateParameters(maxTokens: maxTokens, temperature: 0.8, topP: 0.95)

        let text: String
        let modelId = Config.effectiveModelId
        let isGemma4 = modelId == "gemma_4_e2b_it_4bit" || modelId.hasPrefix("gemma4")

        if isGemma4 {
            let formatted = Gemma4PromptFormatter.userTurn(prompt)
            let tokens = await container.encode(formatted)
            let input = LMInput(tokens: MLXArray(tokens.map { Int32($0) }))
            let stream = try await container.generate(input: input, parameters: params)
            var acc = ""
            for await event in stream {
                if case .chunk(let s) = event { acc += s }
            }
            text = acc
        } else {
            let session = ChatSession(container, generateParameters: params)
            text = try await session.respond(to: prompt)
        }

        let ms = Int(Date().timeIntervalSince(start) * 1000)
        return GenResult(text: text, tokensOut: max(1, text.count / 4), latencyMs: ms)
    }

    func unload() {
        container = nil
        currentModelId = nil
    }
}