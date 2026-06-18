/**
 * Seeds supported models and canary jobs. Idempotent:
 *  - models are upserted by id
 *  - queued (un-dispatched) canary jobs are cleared and re-inserted from
 *    scripts/canaries.json (the Mac/backend contract; see docs/06 §5)
 *
 * Run with: pnpm db:seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { resolve } from "path";
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { jobs, models } from "./schema";
import { id } from "@/app/lib/ids";

const MODELS = [
  {
    id: "gemma3_1b",
    name: "Gemma 3 1B Instruct (4-bit QAT, MLX)",
    downloadUrl: "https://huggingface.co/mlx-community/gemma-3-1b-it-qat-4bit",
    quant: "4bit-qat-mlx",
    sizeMb: 900,
    creditRate: "0.000600",
    enabled: true,
  },
  {
    id: "gemma3n_e2b",
    name: "Gemma 3n E2B (4-bit MLX) — bigger, smarter",
    downloadUrl: "https://huggingface.co/mlx-community/gemma-3n-E2B-it-lm-4bit",
    quant: "4bit-mlx",
    sizeMb: 2000,
    creditRate: "0.001200",
    enabled: true,
  },
  {
    id: "gemma_4_e2b_it_4bit",
    name: "Gemma 4 E2B Instruct (4-bit MLX)",
    downloadUrl: "https://huggingface.co/mlx-community/gemma-4-e2b-it-4bit",
    quant: "4bit-mlx",
    sizeMb: 1600,
    creditRate: "0.002500",
    enabled: true,
  },
  {
    id: "qwen2_5_0_5b",
    name: "Qwen2.5-0.5B-Instruct (4-bit MLX)",
    downloadUrl: "https://huggingface.co/mlx-community/Qwen2.5-0.5B-Instruct-4bit",
    quant: "4bit-mlx",
    sizeMb: 300,
    creditRate: "0.001000",
    enabled: true,
  },
] as const;

type CanaryFile = {
  placeholder?: boolean;
  params?: Record<string, unknown>;
  canaries: { model: string; prompt: string; expected: string; params?: Record<string, unknown> }[];
};

async function main() {
  // 1. Upsert models.
  for (const m of MODELS) {
    await db
      .insert(models)
      .values(m)
      .onConflictDoUpdate({
        target: models.id,
        set: {
          name: m.name,
          downloadUrl: m.downloadUrl,
          quant: m.quant,
          sizeMb: m.sizeMb,
          creditRate: m.creditRate,
          enabled: m.enabled,
        },
      });
  }
  console.log(`Seeded ${MODELS.length} models.`);

  // 2. Load canaries from the shared contract file.
  const canaryPath = resolve(process.cwd(), "../scripts/canaries.json");
  const file = JSON.parse(readFileSync(canaryPath, "utf8")) as CanaryFile;
  if (file.placeholder) {
    console.warn(
      "⚠️  canaries.json is a PLACEHOLDER (dummy expected outputs). " +
        "Regenerate on a Mac with scripts/gen_canaries.py for real Gemma parity.",
    );
  }

  const knownModelIds = new Set<string>(MODELS.map((m) => m.id));
  const defaultParams = file.params ?? { max_tokens: 64, temperature: 0, top_k: 1, seed: 0 };

  // 3. Clear queued (un-dispatched) canaries so re-seeding is idempotent and
  //    never duplicates. Dispatched/done canaries (history) are left intact.
  await db.delete(jobs).where(and(eq(jobs.isCanary, true), eq(jobs.status, "queued")));

  let inserted = 0;
  let skipped = 0;
  for (const c of file.canaries) {
    if (!knownModelIds.has(c.model)) {
      console.warn(`Skipping canary for unknown model "${c.model}"`);
      skipped++;
      continue;
    }
    await db.insert(jobs).values({
      id: id("jb"),
      modelId: c.model,
      prompt: c.prompt,
      params: { ...defaultParams, ...(c.params ?? {}) },
      status: "queued",
      isCanary: true,
      canaryExpected: c.expected,
    });
    inserted++;
  }
  console.log(`Seeded ${inserted} canary jobs${skipped ? ` (${skipped} skipped)` : ""}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
