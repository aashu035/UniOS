#!/usr/bin/env python3
"""Run the UniOS laptop-local companion service."""

from __future__ import annotations

import argparse
import secrets
import sys
from pathlib import Path

from unios_companion.server import CompanionService, run_server


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the private UniOS local companion.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765).")
    parser.add_argument(
        "--allow-lan",
        action="store_true",
        help="Required before binding anywhere other than loopback; trusted LAN/USB only.",
    )
    parser.add_argument(
        "--state-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "state",
        help="Private companion state directory (default: companion/state).",
    )
    parser.add_argument("--model", required=True, help="Name of an already-downloaded local Ollama model.")
    parser.add_argument(
        "--ollama-url",
        default="http://127.0.0.1:11434",
        help="Local Ollama base URL. Only loopback addresses are accepted.",
    )
    parser.add_argument(
        "--pairing-code",
        default=None,
        help="Optional terminal pairing code. If omitted, a random short-lived code is generated.",
    )
    parser.add_argument(
        "--pairing-ttl-minutes",
        type=int,
        default=10,
        help="Pairing-code validity in minutes (default: 10).",
    )
    return parser.parse_args()


def is_loopback_host(host: str) -> bool:
    return host.lower() in {"127.0.0.1", "::1", "localhost"}


def main() -> int:
    args = parse_args()
    if not 1 <= args.port <= 65535:
        print("error: --port must be between 1 and 65535", file=sys.stderr)
        return 2
    if args.pairing_ttl_minutes <= 0:
        print("error: --pairing-ttl-minutes must be positive", file=sys.stderr)
        return 2
    if not is_loopback_host(args.host) and not args.allow_lan:
        print("error: a non-loopback bind requires --allow-lan", file=sys.stderr)
        return 2

    pairing_code = args.pairing_code or secrets.token_urlsafe(9)
    service = CompanionService.create(
        state_dir=args.state_dir,
        model=args.model,
        ollama_url=args.ollama_url,
        pairing_code=pairing_code,
        pairing_ttl_seconds=args.pairing_ttl_minutes * 60,
        lan_enabled=not is_loopback_host(args.host),
    )

    print("UniOS local companion starting")
    print(f"  endpoint: http://{args.host}:{args.port}")
    print(f"  model: {args.model}")
    print(f"  pairing code (expires in {args.pairing_ttl_minutes} min): {pairing_code}")
    if not is_loopback_host(args.host):
        print("  WARNING: trusted-LAN experimental mode; transport encryption/pinning is not implemented.")
    print("  press Ctrl+C to stop")

    try:
        run_server(args.host, args.port, service)
    except KeyboardInterrupt:
        print("\nUniOS local companion stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
