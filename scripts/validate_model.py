#!/usr/bin/env python3
"""
M-prep step 1 (Mac, Apple Silicon): sanity-check that the target model loads and
answers correctly in GREEDY (deterministic) mode.

This is the zero-iOS-risk gate from docs/06 §8.1: confirm the model is usable
before doing anything on device.

Usage:
    pip install -r requirements.txt
    python validate_model.py
    python validate_model.py --model mlx-community/gemma-4-e2b-it-4bit

Decoding is greedy (temperature=0) because the whole server-side verification
(docs/02 §verif) depends on deterministic output.
"""
import argparse

from mlx_lm import generate, load
from mlx_lm.sample_utils import make_sampler

DEFAULT_MODEL = "mlx-community/gemma-4-e2b-it-4bit"

PROMPTS = [
    "What is the capital of France? Answer with one word.",
    "What is 2 + 2? Answer with a number only.",
    "Explain what a coordinator does in a distributed system, in one sentence.",
]


def build_prompt(tokenizer, user_text: str) -> str:
    """Use the tokenizer's chat template (the source of truth) for Mac-side refs.

    On iOS we build the Gemma template literally (docs/06 §3); here we use the
    canonical apply_chat_template so the generated canaries match Python mlx-lm,
    which is exactly what the device output must be checked against.
    """
    messages = [{"role": "user", "content": user_text}]
    return tokenizer.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--max-tokens", type=int, default=64)
    args = parser.parse_args()

    print(f"Loading {args.model} ...")
    model, tokenizer = load(args.model)
    sampler = make_sampler(temp=0.0)  # greedy / deterministic

    for user_text in PROMPTS:
        prompt = build_prompt(tokenizer, user_text)
        out = generate(model, tokenizer, prompt=prompt, max_tokens=args.max_tokens, sampler=sampler)
        print("\n--- PROMPT ---")
        print(user_text)
        print("--- OUTPUT ---")
        print(out.strip())

    print("\nIf the answers look correct, the model is good to go. Next: gen_canaries.py")


if __name__ == "__main__":
    main()
