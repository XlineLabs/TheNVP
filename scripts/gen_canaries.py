#!/usr/bin/env python3
"""
M-prep step 2 (Mac, Apple Silicon): generate REAL canary reference outputs with
the SAME model + SAME quant the workers run (docs/06 §5), greedy/deterministic.

Output: scripts/canaries.json — the contract consumed by:
  - coordinator seed (`pnpm db:seed`) -> jobs.canary_expected
  - the TS simulator honest-mode reference table

Usage:
    pip install -r requirements.txt
    python gen_canaries.py
    python gen_canaries.py --model mlx-community/gemma-4-e2b-it-4bit --model-id gemma_4_e2b_it_4bit

To cover both seeded models, run once per model (it MERGES into canaries.json by
model-id), e.g. also:
    python gen_canaries.py --model mlx-community/Qwen2.5-0.5B-Instruct-4bit --model-id qwen2_5_0_5b
"""
import argparse
import json
import os

from mlx_lm import generate, load
from mlx_lm.sample_utils import make_sampler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, "canaries.json")

# Short, factual, deterministic prompts (docs/06 §5: robust canaries).
PROMPTS = [
    "What is the capital of France? Answer with one word.",
    "What is 2 + 2? Answer with a number only.",
    "Complete with one word: the opposite of hot is",
    "How many days are in one week? Answer with a number only.",
    "What color is the clear daytime sky? Answer with one word.",
    "What is the chemical symbol for water? Answer only the symbol.",
]

PARAMS = {"max_tokens": 64, "temperature": 0, "top_k": 1, "seed": 0}


def build_prompt(tokenizer, user_text: str) -> str:
    messages = [{"role": "user", "content": user_text}]
    return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="mlx-community/gemma-4-e2b-it-4bit")
    parser.add_argument(
        "--model-id",
        default="gemma_4_e2b_it_4bit",
        help="The coordinator's models.id this set maps to.",
    )
    parser.add_argument("--max-tokens", type=int, default=PARAMS["max_tokens"])
    args = parser.parse_args()

    print(f"Loading {args.model} ...")
    model, tokenizer = load(args.model)
    sampler = make_sampler(temp=0.0)  # greedy

    new_entries = []
    for user_text in PROMPTS:
        prompt = build_prompt(tokenizer, user_text)
        out = generate(
            model, tokenizer, prompt=prompt, max_tokens=args.max_tokens, sampler=sampler
        ).strip()
        print(f"  {user_text!r} -> {out!r}")
        new_entries.append({"model": args.model_id, "prompt": user_text, "expected": out})

    # Merge: keep other models' canaries, replace this model-id's set.
    existing = {"canaries": []}
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, "r", encoding="utf-8") as f:
            existing = json.load(f)
    kept = [c for c in existing.get("canaries", []) if c.get("model") != args.model_id]

    result = {
        "placeholder": False,
        "generated_with": args.model,
        "note": "Real greedy outputs from Python mlx-lm. Re-seed the coordinator after updating.",
        "params": PARAMS,
        "canaries": kept + new_entries,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nWrote {len(new_entries)} canaries for '{args.model_id}' to {OUT_PATH}")
    print("Next: `cd ../coordinator && pnpm db:seed`")


if __name__ == "__main__":
    main()
