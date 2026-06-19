import Foundation
#if os(iOS)
import UIKit
#endif

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
        get { UserDefaults.standard.string(forKey: modelKey) ?? "auto" }
        set {
            UserDefaults.standard.set(newValue, forKey: modelKey)
            if newValue == "auto" {
                autoModelSelection = true
            } else {
                autoModelSelection = false
            }
        }
    }

    static var autoModelSelection: Bool {
        get { UserDefaults.standard.bool(forKey: autoModelKey) }
        set { UserDefaults.standard.set(newValue, forKey: autoModelKey) }
    }

    static var effectiveModelId: String {
        if workerModelId == "auto" || autoModelSelection {
            return recommendedModelForDevice()
        }
        return workerModelId
    }

    static var modelCaps: [String] { [effectiveModelId] }

    static let supportedOnDevice: Set<String> = [
        "auto",
        "gemma3_1b",
        "gemma3n_e2b",
        "qwen2_5_0_5b",
        "gemma_4_e2b_it_4bit"
    ]

    static let modelSizesMB: [String: Int] = [
        "gemma3_1b": 900,
        "gemma3n_e2b": 2000,
        "qwen2_5_0_5b": 300,
        "gemma_4_e2b_it_4bit": 1600,
        "auto": 0
    ]

    static func modelSizeGB(_ modelId: String) -> String {
        let mb = modelSizesMB[modelId] ?? 0
        if mb == 0 { return "—" }
        let gb = Double(mb) / 1024.0
        return String(format: "%.1f GB", gb)
    }

    static func recommendedModelForDevice() -> String {
        let totalMemory = ProcessInfo.processInfo.physicalMemory

        #if os(iOS)
        let deviceModel = UIDevice.current.model
        #else
        let deviceModel = "Mac"
        #endif

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