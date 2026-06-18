/**
 * NVP worker simulator (M3). A fake worker that exercises the coordinator's full
 * job lifecycle — register → next → "infer" → submit — without a phone.
 *
 * Modes:
 *   --mode honest : answers canaries correctly (from the reference table) and
 *                   returns a deterministic stub for real jobs.
 *   --mode cheat  : returns garbage, so canaries are rejected.
 *
 * --demo runs an honest worker then a cheater and prints a pass/fail verdict
 * (used by tests/CI). This is a TEST harness only — it never produces real
 * chatbot answers; those come from real iPhones.
 */
import { CoordinatorClient, type Job } from "./api.js";
import { loadCanaryEntries, loadCanaryReference, loadConfig, type Mode } from "./config.js";

const reference = loadCanaryReference();

/** Produce this worker's answer for a job, depending on mode. */
function answer(job: Job, mode: Mode): string {
  if (mode === "cheat") return `wrong-${Math.random().toString(36).slice(2)}`;
  // honest: known canary -> correct answer; real job -> deterministic stub.
  return reference.get(job.prompt) ?? `stub-answer-for:${job.prompt.slice(0, 40)}`;
}

type RunStats = {
  workerId: string;
  processed: number;
  accepted: number;
  rejected: number;
  creditedSum: number;
  balance: number;
};

async function runWorker(
  baseUrl: string,
  models: string[],
  mode: Mode,
  maxJobs: number,
): Promise<RunStats> {
  const client = new CoordinatorClient(baseUrl);
  const reg = await client.register(models);
  console.log(`[${mode}] registered ${reg.worker_id} caps=${models.join(",")}`);

  let processed = 0;
  let accepted = 0;
  let rejected = 0;
  let creditedSum = 0;
  let idleRounds = 0;

  while (maxJobs === 0 || processed < maxJobs) {
    const job = await client.nextJob(models);
    if (!job) {
      // 204: when draining (maxJobs=0) stop after one empty long-poll.
      if (maxJobs === 0) break;
      if (++idleRounds > 3) break;
      continue;
    }
    idleRounds = 0;

    const t0 = Date.now();
    const out = answer(job, mode);
    const latency = Date.now() - t0 + 50; // pretend inference took a bit

    const res = await client.submit(job.job_id, out, latency);
    processed++;
    if (res.accepted) {
      accepted++;
      creditedSum += res.credited;
    } else {
      rejected++;
    }
    if (processed % 10 === 0) console.log(`[${mode}] processed=${processed} balance=${res.balance}`);
  }

  const bal = await client.balance();
  return {
    workerId: reg.worker_id,
    processed,
    accepted,
    rejected,
    creditedSum,
    balance: bal.balance,
  };
}

function printStats(label: string, s: RunStats) {
  console.log(
    `\n=== ${label} ===\n` +
      `  worker:        ${s.workerId}\n` +
      `  processed:     ${s.processed}\n` +
      `  accepted:      ${s.accepted}\n` +
      `  rejected:      ${s.rejected}\n` +
      `  sum(credited): ${s.creditedSum.toFixed(6)}\n` +
      `  balance:       ${s.balance.toFixed(6)}\n` +
      `  balance==sum:  ${Math.abs(s.balance - s.creditedSum) < 1e-9 ? "OK" : "MISMATCH"}`,
  );
}

async function main() {
  const cfg = loadConfig();
  console.log(`Coordinator: ${cfg.baseUrl}`);

  if (cfg.demo) {
    const adminToken = process.env.ADMIN_TOKEN ?? "dev-admin-token-local";
    const entries = loadCanaryEntries();
    const inject = new CoordinatorClient(cfg.baseUrl); // admin calls use the token, not a worker key

    // Fresh canaries for the cheater, who must be rejected on all of them.
    const n1 = await inject.injectCanaries(adminToken, entries);
    console.log(`Injected ${n1} canaries for cheater run.`);
    const cheat = await runWorker(cfg.baseUrl, cfg.models, "cheat", 0);
    printStats("CHEAT", cheat);

    // Fresh canaries again for the honest worker, who must be credited exactly.
    const n2 = await inject.injectCanaries(adminToken, entries);
    console.log(`Injected ${n2} canaries for honest run.`);
    const honest = await runWorker(cfg.baseUrl, cfg.models, "honest", 0);
    printStats("HONEST", honest);

    const honestOk =
      honest.balance > 0 &&
      honest.accepted === honest.processed &&
      Math.abs(honest.balance - honest.creditedSum) < 1e-9;
    const cheatOk = cheat.processed > 0 && cheat.accepted === 0 && cheat.balance === 0;
    console.log(
      `\nVERDICT: honest credited exactly = ${honestOk}; cheater rejected & earned nothing = ${cheatOk}`,
    );
    process.exit(honestOk && cheatOk ? 0 : 1);
  }

  const stats = await runWorker(cfg.baseUrl, cfg.models, cfg.mode, cfg.maxJobs);
  printStats(cfg.mode.toUpperCase(), stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
