# scripts/ — Mac model validation & canary generation

These run on a **Mac with Apple Silicon** (MLX is Apple-Silicon only). They are
the **M-prep** milestone from `docs/05` and `docs/06` §8.

```bash
cd scripts
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 1. Confirm the target model loads and answers correctly (greedy).
python validate_model.py

# 2. Generate real canary reference outputs (writes canaries.json).
python gen_canaries.py --model mlx-community/gemma-4-e2b-it-4bit --model-id gemma_4_e2b_it_4bit
python gen_canaries.py --model mlx-community/Qwen2.5-0.5B-Instruct-4bit --model-id qwen2_5_0_5b

# 3. Load canaries into the DB.
cd ../coordinator && pnpm db:seed
```

## canaries.json — the contract

`canaries.json` is shared by the coordinator seed (→ `jobs.canary_expected`) and
the TS simulator's honest-mode reference table. Shape:

```json
{
  "placeholder": false,
  "generated_with": "mlx-community/gemma-4-e2b-it-4bit",
  "params": { "max_tokens": 64, "temperature": 0, "top_k": 1, "seed": 0 },
  "canaries": [
    { "model": "gemma_4_e2b_it_4bit", "prompt": "...", "expected": "..." }
  ]
}
```

A **placeholder** version (hand-written dummy `expected`) is committed so the
backend + simulator are testable on any machine. Regenerate it on a Mac to get
real Gemma 4 greedy outputs, then re-seed.

> Determinism matters: verification (`docs/02` §verif) compares worker output to
> `expected` by equality, which only holds under greedy decoding
> (temperature=0, top-k=1, fixed seed) with the **same model + quant**.
