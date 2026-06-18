import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Mode = "honest" | "cheat";

export type Config = {
  baseUrl: string;
  mode: Mode;
  models: string[];
  /** Stop after this many jobs processed (0 = until queue drains). */
  maxJobs: number;
  demo: boolean;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function loadConfig(): Config {
  const modeArg = (arg("mode") as Mode) ?? "honest";
  return {
    baseUrl: arg("base") ?? process.env.COORDINATOR_URL ?? "http://localhost:3000",
    mode: modeArg === "cheat" ? "cheat" : "honest",
    models: (arg("models") ?? "gemma_4_e2b_it_4bit,qwen2_5_0_5b").split(",").map((s) => s.trim()),
    maxJobs: Number(arg("max") ?? "0") || 0,
    demo: flag("demo"),
  };
}

/**
 * Honest-mode reference table: prompt -> expected answer, loaded from the shared
 * scripts/canaries.json contract (the same file the coordinator seeds from).
 * This is how an honest worker "knows" the canary answers without running a model
 * — the simulator never runs a real model (real answers come from iPhones).
 */
export type CanaryEntry = { model: string; prompt: string; expected: string };

export function loadCanaryEntries(): CanaryEntry[] {
  const path = resolve(__dirname, "../../scripts/canaries.json");
  const file = JSON.parse(readFileSync(path, "utf8")) as { canaries: CanaryEntry[] };
  return file.canaries;
}

export function loadCanaryReference(): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of loadCanaryEntries()) map.set(c.prompt, c.expected);
  return map;
}
