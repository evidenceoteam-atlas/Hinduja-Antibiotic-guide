"""CLI for the immutable Hinduja CSV bundle."""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

try:
    from scripts.hinduja_csv.bundle import (
        BundleValidationError,
        build_candidate_dataset,
        summary_as_dict,
        validate_bundle,
        validate_release_ready,
    )
except ModuleNotFoundError:  # Direct execution: python scripts/hinduja_csv_bundle.py
    from hinduja_csv.bundle import (
        BundleValidationError,
        build_candidate_dataset,
        summary_as_dict,
        validate_bundle,
        validate_release_ready,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("validate", help="Validate source hashes, schemas, and fidelity counts")
    release = subparsers.add_parser("validate-release", help="Run clinical activation gates")
    release.add_argument("--as-of", type=date.fromisoformat)
    candidate = subparsers.add_parser("candidate", help="Write a deterministic pending-review candidate")
    candidate.add_argument("--output", type=Path, required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "validate":
            summary = validate_bundle()
            print(json.dumps(summary_as_dict(summary), indent=2, ensure_ascii=False))
            print("bundle_validation: PASS")
            return 0
        if args.command == "validate-release":
            summary = validate_release_ready(as_of=args.as_of)
            print(json.dumps(summary_as_dict(summary), indent=2, ensure_ascii=False))
            print("release_validation: PASS")
            return 0
        candidate = build_candidate_dataset()
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(candidate, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"candidate: {args.output}")
        print("candidate_generation: PASS (pending clinical review)")
        return 0
    except BundleValidationError as exc:
        print(f"validation: FAIL\n{exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
