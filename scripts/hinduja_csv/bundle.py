"""Manifest validation and deterministic candidate generation for the CSV bundle."""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any

from .adapters import ADAPTERS, ParsedFile

DEFAULT_SOURCE_ROOT = Path("Hindujacsv")
DEFAULT_MANIFEST_PATH = Path("docs/ground_truth/hinduja_csv_manifest.json")
DEFAULT_CORRECTIONS_PATH = Path("docs/ground_truth/corrections.reviewed.json")


class BundleValidationError(ValueError):
    """Raised when source fidelity or release activation checks fail."""


@dataclass(frozen=True)
class BundleSummary:
    files: int
    records: int
    counts: dict[str, int]
    review_flags: list[dict[str, Any]]
    record_sha256: str


def _load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise BundleValidationError(f"{label} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise BundleValidationError(f"{label} is invalid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise BundleValidationError(f"{label} root must be an object")
    return value


def load_manifest(path: Path = DEFAULT_MANIFEST_PATH) -> dict[str, Any]:
    return _load_object(path, "CSV manifest")


def load_corrections(path: Path = DEFAULT_CORRECTIONS_PATH) -> dict[str, Any]:
    return _load_object(path, "Corrections ledger")


def parse_bundle(
    source_root: Path = DEFAULT_SOURCE_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST_PATH,
) -> list[ParsedFile]:
    manifest = load_manifest(manifest_path)
    entries = manifest.get("files")
    if not isinstance(entries, list) or len(entries) != 21:
        raise BundleValidationError("CSV manifest must declare exactly 21 files")
    declared_names = [entry.get("filename") for entry in entries if isinstance(entry, dict)]
    if len(declared_names) != len(set(declared_names)):
        raise BundleValidationError("CSV manifest contains duplicate filenames")
    actual_names = sorted(path.name for path in source_root.glob("*.csv"))
    if sorted(declared_names) != actual_names:
        missing = sorted(set(declared_names) - set(actual_names))
        unknown = sorted(set(actual_names) - set(declared_names))
        raise BundleValidationError(f"CSV file set mismatch; missing={missing}, unknown={unknown}")

    parsed: list[ParsedFile] = []
    for entry in entries:
        filename = entry.get("filename")
        adapter_name = entry.get("adapter")
        if adapter_name not in ADAPTERS:
            raise BundleValidationError(f"{filename}: unknown adapter {adapter_name!r}")
        path = source_root / filename
        result = ADAPTERS[adapter_name](path)
        if result.file_sha256 != entry.get("sha256"):
            raise BundleValidationError(f"{filename}: SHA-256 mismatch")
        if path.stat().st_size != entry.get("byte_size"):
            raise BundleValidationError(f"{filename}: byte-size mismatch")
        expected_counts = entry.get("expected_counts")
        if expected_counts != result.counts:
            raise BundleValidationError(
                f"{filename}: count contract mismatch; expected={expected_counts}, parsed={result.counts}"
            )
        parsed.append(result)
    return parsed


def _canonical_record_hash(parsed: list[ParsedFile]) -> str:
    import hashlib

    records = [record for item in parsed for record in item.records]
    encoded = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_bundle(
    source_root: Path = DEFAULT_SOURCE_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST_PATH,
) -> BundleSummary:
    parsed = parse_bundle(source_root, manifest_path)
    manifest = load_manifest(manifest_path)
    aggregate = Counter()
    scenario_keys: list[str] = []
    for item in parsed:
        aggregate.update(item.counts)
        scenario_keys.extend(
            record["sheet_key"] for record in item.records if record["record_type"] == "antibiogram_sheet"
        )
    expected = {
        "criteria": 4,
        "guidelines": 25,
        "nonempty_duration_cells": 20,
        "sheets": 16,
        "therapy_slots": 48,
        "nonempty_therapies": 40,
        "blank_therapies": 8,
        "notes": 23,
        "procedures": 11,
        "dosing": 4,
        "pearls": 64,
        "sections": 14,
    }
    mismatches = {
        key: {"expected": value, "parsed": aggregate[key]}
        for key, value in expected.items()
        if aggregate[key] != value
    }
    if mismatches:
        raise BundleValidationError(f"Aggregate source contract mismatch: {mismatches}")
    if len(scenario_keys) != 16 or len(set(scenario_keys)) != 16:
        raise BundleValidationError("Antibiogram scenario keys must contain 16 unique sheets")
    records = sum(len(item.records) for item in parsed)
    record_sha256 = _canonical_record_hash(parsed)
    if record_sha256 != manifest.get("record_sha256"):
        raise BundleValidationError(
            "Canonical record SHA-256 mismatch; source content, keys, roles, sections, or locators changed"
        )
    flags = [{"source_filename": item.filename, **flag} for item in parsed for flag in item.review_flags]
    return BundleSummary(21, records, dict(sorted(aggregate.items())), flags, record_sha256)


def validate_release_ready(
    *,
    source_root: Path = DEFAULT_SOURCE_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST_PATH,
    corrections_path: Path = DEFAULT_CORRECTIONS_PATH,
    as_of: date | None = None,
) -> BundleSummary:
    summary = validate_bundle(source_root, manifest_path)
    ledger = load_corrections(corrections_path)
    release = ledger.get("dataset_release")
    if not isinstance(release, dict):
        raise BundleValidationError("Corrections ledger is missing dataset_release")
    blockers: list[str] = []
    if release.get("status") != "approved":
        blockers.append("dataset release is not approved")
    elif not release.get("reviewer_id") or not release.get("reviewed_at"):
        blockers.append("dataset release approval lacks reviewer evidence")
    try:
        valid_through = date.fromisoformat(str(release.get("valid_through")))
    except ValueError:
        blockers.append("valid_through is not an ISO date")
    else:
        if valid_through < (as_of or date.today()):
            blockers.append(f"dataset release expired on {valid_through.isoformat()}")
    corrections = ledger.get("corrections")
    if not isinstance(corrections, list):
        blockers.append("corrections must be a list")
    else:
        correction_ids = [item.get("correction_id") for item in corrections]
        if len(correction_ids) != len(set(correction_ids)):
            blockers.append("correction IDs are not unique")
        manifest_hashes = {item["sha256"] for item in load_manifest(manifest_path)["files"]}
        unknown_correction_sources = [
            item.get("correction_id", "unknown")
            for item in corrections
            if item.get("source_file_sha256") not in manifest_hashes
        ]
        if unknown_correction_sources:
            blockers.append(
                "corrections reference unknown source hashes: " + ", ".join(unknown_correction_sources)
            )
        unresolved = [
            item.get("correction_id", "unknown")
            for item in corrections
            if item.get("required_for_activation") and item.get("review_status") != "approved"
        ]
        if unresolved:
            blockers.append("unresolved corrections: " + ", ".join(unresolved))
        invalid_approvals = [
            item.get("correction_id", "unknown")
            for item in corrections
            if item.get("review_status") == "approved"
            and (not item.get("reviewer_id") or not item.get("reviewed_at"))
        ]
        if invalid_approvals:
            blockers.append("approved corrections without reviewer evidence: " + ", ".join(invalid_approvals))
    assets = ledger.get("non_csv_source_assets")
    if not isinstance(assets, list) or any(
        item.get("status") != "verified"
        or not item.get("source_filename")
        or len(str(item.get("source_file_sha256", ""))) != 64
        for item in assets
    ):
        blockers.append("one or more non-CSV source assets are not verified")
    if summary.review_flags:
        known_flags = {
            item.get("source_flag_code")
            for item in corrections or []
            if item.get("review_status") == "approved"
        }
        unapproved_flags = [flag["code"] for flag in summary.review_flags if flag["code"] not in known_flags]
        if unapproved_flags:
            blockers.append("unapproved source contradictions: " + ", ".join(sorted(set(unapproved_flags))))
    if blockers:
        raise BundleValidationError("Release activation blocked: " + "; ".join(blockers))
    return summary


def build_candidate_dataset(
    source_root: Path = DEFAULT_SOURCE_ROOT,
    manifest_path: Path = DEFAULT_MANIFEST_PATH,
    corrections_path: Path = DEFAULT_CORRECTIONS_PATH,
) -> dict[str, Any]:
    parsed = parse_bundle(source_root, manifest_path)
    summary = validate_bundle(source_root, manifest_path)
    ledger = load_corrections(corrections_path)
    records = [record for item in parsed for record in item.records]
    by_type: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_type.setdefault(record["record_type"], []).append(record)
    return {
        "schema_version": 1,
        "dataset_release": ledger["dataset_release"],
        "source_manifest": str(manifest_path),
        "source_bundle_record_sha256": summary.record_sha256,
        "activation_status": "blocked_pending_clinical_review",
        "records": by_type,
        "review_flags": summary.review_flags,
    }


def summary_as_dict(summary: BundleSummary) -> dict[str, Any]:
    return asdict(summary)
