/** Thin client for the coordinator API, from a worker's perspective. */

export type Job = {
  job_id: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
};

export type SubmitResult = {
  accepted: boolean;
  credited: number;
  balance: number;
  reason?: string;
};

export class CoordinatorClient {
  private apiKey?: string;
  constructor(private baseUrl: string) {}

  async register(modelCaps: string[]): Promise<{ worker_id: string; api_key: string }> {
    const res = await fetch(`${this.baseUrl}/api/workers/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device_pubkey: `ed25519:sim-${Math.random().toString(36).slice(2)}`,
        platform: "simulator",
        model_caps: modelCaps,
      }),
    });
    if (!res.ok) throw new Error(`register failed: HTTP ${res.status}`);
    const data = await res.json();
    this.apiKey = data.api_key;
    return data;
  }

  private headers(): HeadersInit {
    if (!this.apiKey) throw new Error("not registered");
    return { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" };
  }

  /** Returns a job, or null on 204 (no job available within the long-poll window). */
  async nextJob(models: string[]): Promise<Job | null> {
    const res = await fetch(`${this.baseUrl}/api/jobs/next?models=${models.join(",")}`, {
      headers: this.headers(),
    });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`jobs/next failed: HTTP ${res.status}`);
    return res.json();
  }

  async submit(jobId: string, output: string, latencyMs: number): Promise<SubmitResult> {
    const res = await fetch(`${this.baseUrl}/api/jobs/${jobId}/result`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ output, latency_ms: latencyMs }),
    });
    if (!res.ok) throw new Error(`result failed: HTTP ${res.status}`);
    return res.json();
  }

  /** Admin helper (demo only): inject a fresh batch of canary jobs. */
  async injectCanaries(
    adminToken: string,
    canaries: { model: string; prompt: string; expected: string }[],
  ): Promise<number> {
    const res = await fetch(`${this.baseUrl}/api/admin/canaries`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify({ canaries }),
    });
    if (!res.ok) throw new Error(`admin/canaries failed: HTTP ${res.status}`);
    return (await res.json()).inserted as number;
  }

  async balance(): Promise<{ balance: number; jobs_done: number }> {
    const res = await fetch(`${this.baseUrl}/api/me/balance`, { headers: this.headers() });
    if (!res.ok) throw new Error(`balance failed: HTTP ${res.status}`);
    return res.json();
  }
}
