import Foundation
import UIKit

enum Config {
    private static let coordinatorKey = "coordinator_url"

    static let defaultCoordinatorURL = "https://nvp-coordinator.vercel.app"

    static var coordinatorURL: String {
        get { UserDefaults.standard.string(forKey: coordinatorKey) ?? defaultCoordinatorURL }
        set { UserDefaults.standard.set(newValue, forKey: coordinatorKey) }
    }

    private static let modelKey = "worker_model_id"
    private static let autoModelKey = "auto_model_selection"

    static var workerModelId: String {
        get { UserDefaults.standard.string(forKey: modelKey) ?? "gemma3_1b" }
        set { UserDefaults.standard.set(newValue, forKey: modelKey) }
    }

    static var autoModelSelection: Bool {
        get { UserDefaults.standard.bool(forKey: autoModelKey) }
        set { UserDefaults.standard.set(newValue, forKey: autoModelKey) }
    }

    static var modelCaps: [String] { [workerModelId] }

    static let supportedOnDevice: Set<String> = [
        "gemma3_1b",
        "gemma3n_e2b",
        "qwen2_5_0_5b",
        "gemma_4_e2b_it_4bit"
    ]

    static let modelSizesMB: [String: Int] = [
        "gemma3_1b": 900,
        "gemma3n_e2b": 2000,
        "qwen2_5_0_5b": 300,
        "gemma_4_e2b_it_4bit": 1600
    ]

    static func modelSizeGB(_ modelId: String) -> String {
        let mb = modelSizesMB[modelId] ?? 0
        let gb = Double(mb) / 1024.0
        return String(format: "%.1f GB", gb)
    }

    static func recommendedModelForDevice() -> String {
        let deviceModel = UIDevice.current.model
        let totalMemory = ProcessInfo.processInfo.physicalMemory

        if totalMemory >= 8 * 1024 * 1024 * 1024 {
            return "gemma_4_e2b_it_4bit"
        } else if totalMemory >= 6 * 1024 * 1024 * 1024 {
            return "gemma3n_e2b"
        } else if totalMemory >= 4 * 1024 * 1024 * 1024 {
            return "gemma3_1b"
        } else {
            return "qwen2_5_0_5b"
        }
    }
}