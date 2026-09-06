#!/usr/bin/env python3
"""
Run a one-shot GPT-6 Astra audit of uniOS.

Usage:
    export EXPLABS_API_KEY=sk-...
    python scripts/run_astra_audit.py | tee AUDIT_RAW.md
"""
import os
from openai import OpenAI

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRIEF = open(os.path.join(ROOT, "AUDITOR_BRIEF.md"), "r", encoding="utf-8").read()
BUNDLE = open(os.path.join(ROOT, "AUDITOR_BUNDLE_GPT6.md"), "r", encoding="utf-8").read()

client = OpenAI(
    base_url="https://api.experientiallabs.ai/v1",
    api_key=os.environ["EXPLABS_API_KEY"],
)

response = client.chat.completions.create(
    model="gpt-6-astra",
    stream=True,
    messages=[
        {
            "role": "user",
            "content": BRIEF + "\n\n---\n\n# BUNDLE (actual repo state)\n\n" + BUNDLE,
        },
    ],
)

import sys
for chunk in response:
    delta = chunk.choices[0].delta.content
    if delta:
        sys.stdout.write(delta)
        sys.stdout.flush()
print()
