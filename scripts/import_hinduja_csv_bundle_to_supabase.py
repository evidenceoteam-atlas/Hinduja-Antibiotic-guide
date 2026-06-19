"""Import the verified Hinduja CSV bundle as a pending-review dataset release.

This importer intentionally has no --approve switch. Clinical review, correction
adjudication, and release activation are separate audited database actions.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Any

try:
    from scripts.hinduja_csv.bundle import (
        DEFAULT_MANIFEST_PATH,
        build_candidate_dataset,
        load_corrections,
        parse_bundle,
        validate_bundle,
    )
except ModuleNotFoundError:  # Direct execution from the repository root.
    from hinduja_csv.bundle import (
        DEFAULT_MANIFEST_PATH,
        build_candidate_dataset,
        load_corrections,
        parse_bundle,
        validate_bundle,
    )


@dataclass(frozen=True)
class CsvImportPlan:
    candidate: dict[str, Any]
    counts: dict[str, int]


def build_import_plan() -> CsvImportPlan:
    candidate = build_candidate_dataset()
    counts = Counter({"clinical_dataset_releases": 1, "clinical_source_files": 21})
    counts["clinical_source_spans"] = sum(len(item.records) for item in parse_bundle())
    mapping = {
        "patient_risk_criterion": "patient_risk_criteria",
        "icmr_guideline": "icmr_guideline_rows",
        "antibiogram_sheet": "antibiogram_sheets",
        "antibiogram_therapy_slot": "antibiogram_therapy_source_slots",
        "antibiogram_note": "antibiogram_footnotes",
        "perioperative_procedure": "perioperative_procedure_recommendations",
        "perioperative_dosing": "perioperative_antibiotic_dosing",
        "perioperative_note": "perioperative_notes",
        "stewardship_pearl": "stewardship_pearl_rows",
        "ama_pearl": "antimicrobial_pearl_point_rows",
    }
    for record_type, records in candidate["records"].items():
        if record_type in mapping:
            counts[mapping[record_type]] += len(records)
        if record_type == "icmr_guideline":
            counts["duration_guideline_rows"] += sum(bool(row["duration"]) for row in records)
        if record_type == "antibiogram_therapy_slot":
            counts["antibiogram_empiric_therapy"] += sum(bool(row["therapy"]) for row in records)
    counts["clinical_source_corrections"] = len(load_corrections()["corrections"])
    counts["clinical_release_source_assets"] = 21 + len(load_corrections()["non_csv_source_assets"])
    return CsvImportPlan(candidate, dict(sorted(counts.items())))


def database_url_from_env() -> str:
    value = os.environ.get("SUPABASE_DB_URL")
    if not value:
        raise RuntimeError("Set SUPABASE_DB_URL to the Supabase Postgres connection string.")
    return value


def _quote(record: dict[str, Any]) -> str:
    return "\n".join(record["source_values"])


async def _source_file_id(conn: Any, filename: str, sha256: str) -> str:
    return str(
        await conn.fetchval(
            """
            insert into public.clinical_source_files (filename, original_path, file_sha256, mime_type)
            values ($1, $2, $3, 'text/csv')
            on conflict (file_sha256) do update set filename = excluded.filename
            returning id
            """,
            filename,
            f"Hindujacsv/{filename}",
            sha256,
        )
    )


async def _source_span_id(conn: Any, source_file_id: str, record: dict[str, Any]) -> str:
    locator = record["source_locator"]
    row_start = int(locator["row_start"])
    row_end = int(locator["row_end"])
    existing = await conn.fetchval(
        """
        select id from public.clinical_source_spans
        where source_file_id = $1
          and page_number is null
          and span_start = $2
          and span_end = $3
          and source_locator = $4::jsonb
        """,
        source_file_id,
        row_start,
        row_end,
        json.dumps(locator, ensure_ascii=False),
    )
    if existing:
        return str(existing)
    return str(
        await conn.fetchval(
            """
            insert into public.clinical_source_spans (
              source_file_id, page_number, section_heading, span_start, span_end,
              quote, source_locator, source_value_sha256
            )
            values ($1, null, $2, $3, $4, $5, $6::jsonb, $7)
            returning id
            """,
            source_file_id,
            record["record_type"],
            row_start,
            row_end,
            _quote(record),
            json.dumps(locator, ensure_ascii=False),
            record["source_value_sha256"],
        )
    )


async def _release_id(conn: Any, candidate: dict[str, Any]) -> str:
    release = candidate["dataset_release"]
    manifest_hash = hashlib.sha256(DEFAULT_MANIFEST_PATH.read_bytes()).hexdigest()
    existing = await conn.fetchrow(
        """
        select id, source_manifest_sha256
        from public.clinical_dataset_releases
        where release_key = $1
        """,
        release["release_key"],
    )
    if existing:
        if existing["source_manifest_sha256"] != manifest_hash:
            raise RuntimeError(
                "Release key already exists with a different source manifest; create a new release key."
            )
        return str(existing["id"])
    return str(
        await conn.fetchval(
            """
            insert into public.clinical_dataset_releases (
              release_key, guide_version, source_manifest_sha256, status,
              valid_through, activation_note
            )
            values ($1, $2, $3, 'pending_review', $4::date, $5)
            returning id
            """,
            release["release_key"],
            release["guide_version"],
            manifest_hash,
            date.fromisoformat(release["valid_through"]),
            release["activation_note"],
        )
    )


async def _insert_pending_row(
    conn: Any,
    table: str,
    payload: dict[str, Any],
    conflict_columns: tuple[str, ...],
) -> str:
    columns = list(payload)
    placeholders = ", ".join(f"${index}" for index in range(1, len(columns) + 1))
    conflicts = ", ".join(conflict_columns)
    query = f"""
        insert into public.{table} ({", ".join(columns)})
        values ({placeholders})
        on conflict ({conflicts}) do update
        set review_status = {table}.review_status
        returning id
    """
    values = [
        json.dumps(payload[column], ensure_ascii=False)
        if isinstance(payload[column], dict | list)
        else payload[column]
        for column in columns
    ]
    return str(await conn.fetchval(query, *values))


async def import_pending_release(database_url: str) -> dict[str, int]:
    try:
        import asyncpg
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("asyncpg is required for database imports.") from exc

    validate_bundle()
    parsed = parse_bundle()
    candidate = build_candidate_dataset()
    conn = await asyncpg.connect(database_url)
    counts = Counter()
    try:
        async with conn.transaction():
            release_id = await _release_id(conn, candidate)
            counts["clinical_dataset_releases"] = 1
            file_ids: dict[str, str] = {}
            span_ids: dict[tuple[str, str, int, int], str] = {}
            for item in parsed:
                file_ids[item.filename] = await _source_file_id(conn, item.filename, item.file_sha256)
                counts["clinical_source_files"] += 1
                for record in item.records:
                    locator = record["source_locator"]
                    key = (item.filename, record["record_type"], locator["row_start"], locator["row_end"])
                    span_ids[key] = await _source_span_id(conn, file_ids[item.filename], record)
                    counts["clinical_source_spans"] += 1

                await _insert_pending_row(
                    conn,
                    "clinical_release_source_assets",
                    {
                        "dataset_release_id": release_id,
                        "asset_key": item.filename,
                        "asset_kind": "csv",
                        "source_file_id": file_ids[item.filename],
                        "required_for_activation": True,
                        "verification_status": "verified",
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "asset_key"),
                )
                counts["clinical_release_source_assets"] += 1

            for asset in load_corrections()["non_csv_source_assets"]:
                await _insert_pending_row(
                    conn,
                    "clinical_release_source_assets",
                    {
                        "dataset_release_id": release_id,
                        "asset_key": asset["asset_key"],
                        "asset_kind": "other",
                        "source_file_id": None,
                        "required_for_activation": asset["required_for_activation"],
                        "verification_status": asset["status"],
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "asset_key"),
                )
                counts["clinical_release_source_assets"] += 1

            def span_for(record: dict[str, Any]) -> str:
                locator = record["source_locator"]
                return span_ids[
                    (
                        record["source_filename"],
                        record["record_type"],
                        locator["row_start"],
                        locator["row_end"],
                    )
                ]

            for correction in load_corrections()["corrections"]:
                await _insert_pending_row(
                    conn,
                    "clinical_source_corrections",
                    {
                        "dataset_release_id": release_id,
                        "correction_id": correction["correction_id"],
                        "source_file_sha256": correction["source_file_sha256"],
                        "source_locator": correction["source_locator"],
                        "field_name": correction["field"],
                        "source_value": correction.get("source_value"),
                        "proposed_value": correction.get("proposed_value"),
                        "reason": correction["reason"],
                        "classification": correction["classification"],
                        "required_for_activation": correction["required_for_activation"],
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "correction_id"),
                )
                counts["clinical_source_corrections"] += 1

            criterion_codes = {
                "Definition": "definition",
                "Hospital contact": "hospital_contact",
                "Antibiotic exposure": "antibiotic_exposure",
                "Co-morbidities": "co_morbidities",
            }
            for row in candidate["records"]["patient_risk_criterion"]:
                await _insert_pending_row(
                    conn,
                    "patient_risk_criteria",
                    {
                        "dataset_release_id": release_id,
                        "source_span_id": span_for(row),
                        "criterion_code": criterion_codes[row["criterion_name"]],
                        "criterion_label": row["criterion_name"],
                        "type_1": row["values"]["1"],
                        "type_2": row["values"]["2"],
                        "type_3": row["values"]["3"],
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "criterion_code"),
                )
                counts["patient_risk_criteria"] += 1

            for row in candidate["records"]["icmr_guideline"]:
                common = {
                    "dataset_release_id": release_id,
                    "source_span_id": span_for(row),
                    "source_quote": _quote(row),
                    "source_page": None,
                    "source_section": "ICMR Guidelines",
                    "review_status": "pending_review",
                }
                await _insert_pending_row(
                    conn,
                    "icmr_guideline_rows",
                    {
                        **common,
                        "clinical_condition": row["clinical_condition"],
                        "infection_code": row["infection_code"],
                        "common_pathogens": row["common_pathogens"],
                        "empirical_ama": row["empirical_ama"],
                        "alternate_ama": row["alternate_ama"],
                        "comments": row["comments"],
                        # A6: persist Remarks on the ICMR row itself so it is never
                        # dropped when Duration is empty (duration_guideline_rows,
                        # which also carries remarks, is only written when duration
                        # is non-empty below).
                        "remarks": row["remarks"],
                    },
                    ("dataset_release_id", "clinical_condition", "source_span_id"),
                )
                counts["icmr_guideline_rows"] += 1
                if row["duration"]:
                    await _insert_pending_row(
                        conn,
                        "duration_guideline_rows",
                        {
                            **common,
                            "infection": row["clinical_condition"],
                            "duration": row["duration"],
                            "remarks": row["remarks"],
                        },
                        ("dataset_release_id", "infection", "source_span_id"),
                    )
                    counts["duration_guideline_rows"] += 1

            sheet_ids: dict[str, str] = {}
            for row in candidate["records"]["antibiogram_sheet"]:
                sheet_ids[row["sheet_key"]] = await _insert_pending_row(
                    conn,
                    "antibiogram_sheets",
                    {
                        "dataset_release_id": release_id,
                        "source_span_id": span_for(row),
                        "infection_type": row["infection_type"],
                        "location": row["location"],
                        "acquisition": row["acquisition"],
                        "sheet_title": row["sheet_title"],
                        "section_notes": [],
                        "source_quote": _quote(row),
                        "source_page": None,
                        "source_section": "Local Antibiogram",
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "infection_type", "location", "acquisition"),
                )
                counts["antibiogram_sheets"] += 1

            for row in candidate["records"]["antibiogram_therapy_slot"]:
                await _insert_pending_row(
                    conn,
                    "antibiogram_therapy_source_slots",
                    {
                        "dataset_release_id": release_id,
                        "antibiogram_sheet_id": sheet_ids[row["sheet_key"]],
                        "source_span_id": span_for(row),
                        "sheet_key": row["sheet_key"],
                        "risk_type": row["risk_type"],
                        "source_value": row["therapy"],
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "sheet_key", "risk_type"),
                )
                counts["antibiogram_therapy_source_slots"] += 1
                if row["therapy"]:
                    await _insert_pending_row(
                        conn,
                        "antibiogram_empiric_therapy",
                        {
                            "dataset_release_id": release_id,
                            "antibiogram_sheet_id": sheet_ids[row["sheet_key"]],
                            "source_span_id": span_for(row),
                            "sheet_key": row["sheet_key"],
                            "risk_type": row["risk_type"],
                            "empiric_therapy": row["therapy"],
                            "source_quote": _quote(row),
                            "source_page": None,
                            "source_section": "Local Antibiogram",
                            "review_status": "pending_review",
                        },
                        ("dataset_release_id", "sheet_key", "risk_type"),
                    )
                    counts["antibiogram_empiric_therapy"] += 1

            for row in candidate["records"]["antibiogram_note"]:
                await _insert_pending_row(
                    conn,
                    "antibiogram_footnotes",
                    {
                        "dataset_release_id": release_id,
                        "antibiogram_sheet_id": sheet_ids[row["sheet_key"]],
                        "source_span_id": span_for(row),
                        "sheet_key": row["sheet_key"],
                        "risk_type": None,
                        "note": row["note"],
                        "source_quote": _quote(row),
                        "source_page": None,
                        "source_section": "Local Antibiogram",
                        "review_status": "pending_review",
                    },
                    ("dataset_release_id", "sheet_key", "note"),
                )
                counts["antibiogram_footnotes"] += 1

            await _import_simple_sections(conn, release_id, candidate, span_for, counts)
    finally:
        await conn.close()
    return dict(sorted(counts.items()))


async def _import_simple_sections(
    conn: Any,
    release_id: str,
    candidate: dict[str, Any],
    span_for: Any,
    counts: Counter,
) -> None:
    for row in candidate["records"]["perioperative_procedure"]:
        await _insert_pending_row(
            conn,
            "perioperative_procedure_recommendations",
            {
                "dataset_release_id": release_id,
                "source_span_id": span_for(row),
                "procedure": row["procedure"],
                "preferred_drug": row["preferred_drug"],
                "source_quote": _quote(row),
                "source_page": None,
                "source_section": "Perioperative Prophylaxis",
                "review_status": "pending_review",
            },
            ("dataset_release_id", "procedure", "source_span_id"),
        )
        counts["perioperative_procedure_recommendations"] += 1
    for row in candidate["records"]["perioperative_dosing"]:
        await _insert_pending_row(
            conn,
            "perioperative_antibiotic_dosing",
            {
                "dataset_release_id": release_id,
                "source_span_id": span_for(row),
                "drug": row["drug"],
                "standard_dose": row["standard_dose"],
                "weight_based_dose": row["weight_based_dose"],
                "bolus_duration": row["bolus_duration"],
                "infusion_duration": row["infusion_duration"],
                "bolus_or_infusion_duration": " / ".join(
                    value for value in (row["bolus_duration"], row["infusion_duration"]) if value
                )
                or None,
                "source_quote": _quote(row),
                "source_page": None,
                "source_section": "Perioperative Prophylaxis",
                "review_status": "pending_review",
            },
            ("dataset_release_id", "drug", "source_span_id"),
        )
        counts["perioperative_antibiotic_dosing"] += 1
    for row in candidate["records"]["perioperative_note"]:
        await _insert_pending_row(
            conn,
            "perioperative_notes",
            {
                "dataset_release_id": release_id,
                "source_span_id": span_for(row),
                "note_type": row["note_type"],
                "note_text": row["note_text"],
                "sort_order": row["sort_order"],
                "source_quote": _quote(row),
                "source_page": None,
                "source_section": "Perioperative Prophylaxis",
                "review_status": "pending_review",
            },
            ("dataset_release_id", "note_type", "sort_order", "source_span_id"),
        )
        counts["perioperative_notes"] += 1
    for record_type, table in (
        ("stewardship_pearl", "stewardship_pearl_rows"),
        ("ama_pearl", "antimicrobial_pearl_point_rows"),
    ):
        for row in candidate["records"][record_type]:
            await _insert_pending_row(
                conn,
                table,
                {
                    "dataset_release_id": release_id,
                    "source_span_id": span_for(row),
                    "section_name": row["section_name"],
                    "pearl_text": row["pearl_text"],
                    "sort_order": row["sort_order"],
                    "source_quote": _quote(row),
                    "source_page": None,
                    "source_section": row["section_name"],
                    "review_status": "pending_review",
                },
                ("dataset_release_id", "section_name", "sort_order", "source_span_id"),
            )
            counts[table] += 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "command",
        choices=("validate", "dry-run", "import-pending"),
        help="Validate, preview counts, or write a pending-review release.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        summary = validate_bundle()
        if args.command == "validate":
            print(f"files: {summary.files}")
            print(f"records: {summary.records}")
            print(f"record_sha256: {summary.record_sha256}")
            print("validation: PASS")
            return 0
        if args.command == "dry-run":
            counts = build_import_plan().counts
        else:
            counts = asyncio.run(import_pending_release(database_url_from_env()))
        print(f"command: {args.command}")
        for table, count in counts.items():
            print(f"  - {table}: {count}")
        print("import: PASS" if args.command == "import-pending" else "dry_run: PASS")
        return 0
    except (RuntimeError, ValueError) as exc:
        print(f"{args.command}: FAIL")
        print(exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
