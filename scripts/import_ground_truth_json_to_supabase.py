"""Validate and import reviewed Hinduja ground-truth JSON into Supabase.

Phase 3B keeps imports conservative:
- validate remains read-only
- database writes require SUPABASE_DB_URL
- rows default to pending_review
- --approve requires CLINICAL_REVIEWER_ID
- clinical text is copied from JSON values without normalization or inference
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

GROUND_TRUTH_PATH = Path("docs/ground_truth/hinduja_antibiotic_guide_2025.reviewed.json")

REQUIRED_TOP_LEVEL_SECTIONS = [
    "metadata",
    "icmr_guidelines",
    "duration_of_treatment",
    "antibiograms",
    "synergy_and_antifungal",
    "stewardship_pearls",
    "pearl_points",
    "perioperative",
]

EXPECTED_COUNTS = {
    "icmr_guidelines": 25,
    "duration_of_treatment": 22,
    "antibiogram_infection_groups": 4,
    "antibiogram_sheets": 16,
    "synergy_testing_rows": 2,
    "synergy_antifungal_notes_rows": 3,
    "perioperative_procedure_rows": 11,
    "perioperative_antibiotic_dosing_rows": 4,
}

SECTION_PAGES = {
    "metadata": 1,
    "icmr_guidelines": 4,
    "duration_of_treatment": 11,
    "antibiograms": 13,
    "synergy_testing": 46,
    "antifungal_susceptibility": 46,
    "synergy_antifungal_notes": 46,
    "stewardship_pearls": 48,
    "pearl_points": 50,
    "perioperative": 52,
}

IMPORT_COMMANDS = {
    "import-icmr",
    "import-duration",
    "import-antibiograms",
    "import-synergy-antifungal",
    "import-stewardship",
    "import-perioperative",
    "import-all",
}


@dataclass(frozen=True)
class ValidationSummary:
    path: Path
    counts: dict[str, int]
    required_sections: list[str]


@dataclass(frozen=True)
class SourceSpanPlan:
    source_quote: str
    source_page: int | None
    source_section: str
    span_start: int
    span_end: int


@dataclass(frozen=True)
class ImportRowPlan:
    table: str
    payload: dict[str, Any]
    identity: dict[str, Any]
    source_span: SourceSpanPlan


@dataclass
class ImportCounts:
    source_files_inserted: int = 0
    source_files_skipped: int = 0
    source_spans_inserted: int = 0
    source_spans_skipped: int = 0
    rows_inserted: dict[str, int] = field(default_factory=dict)
    rows_skipped: dict[str, int] = field(default_factory=dict)

    def inserted(self, table: str) -> None:
        self.rows_inserted[table] = self.rows_inserted.get(table, 0) + 1

    def skipped(self, table: str) -> None:
        self.rows_skipped[table] = self.rows_skipped.get(table, 0) + 1


def load_ground_truth_json(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except FileNotFoundError as exc:
        raise ValueError(f"Ground-truth JSON not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Ground-truth JSON is not valid JSON: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError("Ground-truth JSON root must be an object")

    return payload


def expect_list(value: Any, label: str) -> list[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be a list")
    return value


def expect_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object")
    return value


def count_antibiogram_sheets(antibiograms: dict[str, Any]) -> int:
    sheet_count = 0
    for infection_group, locations in antibiograms.items():
        locations = expect_object(locations, f"antibiograms.{infection_group}")
        for location, acquisitions in locations.items():
            acquisitions = expect_object(acquisitions, f"antibiograms.{infection_group}.{location}")
            sheet_count += len(acquisitions)
    return sheet_count


def validate_ground_truth_payload(payload: dict[str, Any], path: Path) -> ValidationSummary:
    missing_sections = [
        section for section in REQUIRED_TOP_LEVEL_SECTIONS if section not in payload
    ]
    if missing_sections:
        raise ValueError("Missing required sections: " + ", ".join(missing_sections))

    icmr_guidelines = expect_list(payload["icmr_guidelines"], "icmr_guidelines")
    durations = expect_list(payload["duration_of_treatment"], "duration_of_treatment")
    antibiograms = expect_object(payload["antibiograms"], "antibiograms")
    synergy_and_antifungal = expect_object(
        payload["synergy_and_antifungal"], "synergy_and_antifungal"
    )
    perioperative = expect_object(payload["perioperative"], "perioperative")

    synergy_testing = expect_list(
        synergy_and_antifungal.get("synergy_testing"),
        "synergy_and_antifungal.synergy_testing",
    )
    synergy_notes = expect_list(
        synergy_and_antifungal.get("notes"),
        "synergy_and_antifungal.notes",
    )
    procedure_rows = expect_list(
        perioperative.get("procedure_recommendations"),
        "perioperative.procedure_recommendations",
    )
    dosing_rows = expect_list(
        perioperative.get("antibiotic_dosing"),
        "perioperative.antibiotic_dosing",
    )

    counts = {
        "icmr_guidelines": len(icmr_guidelines),
        "duration_of_treatment": len(durations),
        "antibiogram_infection_groups": len(antibiograms),
        "antibiogram_sheets": count_antibiogram_sheets(antibiograms),
        "synergy_testing_rows": len(synergy_testing),
        "synergy_antifungal_notes_rows": len(synergy_notes),
        "perioperative_procedure_rows": len(procedure_rows),
        "perioperative_antibiotic_dosing_rows": len(dosing_rows),
    }

    mismatches = [
        f"{name}: expected {expected}, found {counts[name]}"
        for name, expected in EXPECTED_COUNTS.items()
        if counts[name] != expected
    ]
    if mismatches:
        raise ValueError("Count validation failed: " + "; ".join(mismatches))

    return ValidationSummary(
        path=path,
        counts=counts,
        required_sections=REQUIRED_TOP_LEVEL_SECTIONS.copy(),
    )


def validate_ground_truth_file(path: Path = GROUND_TRUTH_PATH) -> ValidationSummary:
    return validate_ground_truth_payload(load_ground_truth_json(path), path)


def print_validation_summary(summary: ValidationSummary) -> None:
    print("Ground truth validation summary")
    print(f"file: {summary.path}")
    print("required_sections: PASS")
    for section in summary.required_sections:
        print(f"  - {section}")
    print("expected_counts: PASS")
    for name in EXPECTED_COUNTS:
        print(f"  - {name}: {summary.counts[name]}")
    print("validation: PASS")


def exact_json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=False)


def source_quote_for(section: str, value: Any) -> str:
    return exact_json_text({"section": section, "data": value})


def source_span_for(section: str, value: Any, source_page: int | None = None) -> SourceSpanPlan:
    source_quote = source_quote_for(section, value)
    digest = hashlib.sha256(f"{section}:{source_quote}".encode()).hexdigest()
    # 7 hex chars = 28 bits; fits clinical_source_spans.span_start (int32) with
    # room to spare. Was previously digest[:12] which produced 48-bit values and
    # overflowed the column on every run. The existing 721 production rows were
    # imported under digest[:7] (confirmed max span_start = 267,441,140 < 2^28).
    span_start = int(digest[:7], 16)
    return SourceSpanPlan(
        source_quote=source_quote,
        source_page=source_page if source_page is not None else SECTION_PAGES.get(section),
        source_section=section,
        span_start=span_start,
        span_end=span_start + len(source_quote),
    )


def review_fields(*, approve: bool, reviewer_id: str | None = None) -> dict[str, Any]:
    if not approve:
        return {"review_status": "pending_review", "reviewer_id": None, "reviewed_at": None}
    if not reviewer_id:
        raise RuntimeError("CLINICAL_REVIEWER_ID is required when --approve is passed.")
    return {
        "review_status": "approved",
        "reviewer_id": reviewer_id,
        "reviewed_at": datetime.now(UTC),
    }


def source_fields(span: SourceSpanPlan) -> dict[str, Any]:
    return {
        "source_quote": span.source_quote,
        "source_page": span.source_page,
        "source_section": span.source_section,
    }


def row_plan(
    *,
    table: str,
    payload: dict[str, Any],
    identity: dict[str, Any],
    source_span: SourceSpanPlan,
    approve: bool,
    reviewer_id: str | None,
) -> ImportRowPlan:
    return ImportRowPlan(
        table=table,
        payload={
            **payload,
            **source_fields(source_span),
            **review_fields(approve=approve, reviewer_id=reviewer_id),
        },
        identity=identity,
        source_span=source_span,
    )


def build_document_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    metadata = expect_object(payload["metadata"], "metadata")
    span = source_span_for("metadata", metadata)
    return [
        row_plan(
            table="clinical_guide_documents",
            payload={
                "source_document": metadata["source_document"],
                "institution_address": metadata.get("institution_address"),
                "contact": metadata.get("contact"),
                "surveillance_period": metadata.get("surveillance_period"),
                "valid_till": metadata.get("valid_till"),
                "document_index": metadata.get("index", []),
            },
            identity={"source_document": metadata["source_document"]},
            source_span=span,
            approve=approve,
            reviewer_id=reviewer_id,
        )
    ]


def build_icmr_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    rows = []
    for row in expect_list(payload["icmr_guidelines"], "icmr_guidelines"):
        span = source_span_for("icmr_guidelines", row)
        rows.append(
            row_plan(
                table="icmr_guideline_rows",
                payload={
                    "clinical_condition": row["clinical_condition"],
                    "common_pathogens": row.get("common_pathogens"),
                    "empirical_ama": row.get("empirical_ama"),
                    "alternate_ama": row.get("alternate_ama"),
                    "comments": row.get("comments"),
                },
                identity={"clinical_condition": row["clinical_condition"]},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    return rows


def build_duration_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    rows = []
    for row in expect_list(payload["duration_of_treatment"], "duration_of_treatment"):
        span = source_span_for("duration_of_treatment", row)
        rows.append(
            row_plan(
                table="duration_guideline_rows",
                payload={
                    "infection": row["infection"],
                    "duration": row["duration"],
                    "remarks": row.get("remarks"),
                },
                identity={"infection": row["infection"]},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    return rows


def build_antibiogram_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    rows: list[ImportRowPlan] = []
    antibiograms = expect_object(payload["antibiograms"], "antibiograms")
    for infection_type, locations in antibiograms.items():
        for location, acquisitions in expect_object(locations, f"antibiograms.{infection_type}").items():
            for acquisition, sheet in expect_object(
                acquisitions, f"antibiograms.{infection_type}.{location}"
            ).items():
                sheet_key = f"{infection_type}.{location}.{acquisition}"
                span = source_span_for("antibiograms", sheet)
                rows.append(
                    row_plan(
                        table="antibiogram_sheets",
                        payload={
                            "infection_type": infection_type,
                            "location": location,
                            "acquisition": acquisition,
                            "sheet_title": sheet["sheet_title"],
                            "surveillance": sheet.get("surveillance"),
                            "type_totals": sheet.get("type_totals", {}),
                            "section_notes": sheet.get("section_notes", []),
                        },
                        identity={
                            "infection_type": infection_type,
                            "location": location,
                            "acquisition": acquisition,
                        },
                        source_span=span,
                        approve=approve,
                        reviewer_id=reviewer_id,
                    )
                )
                rows.extend(
                    build_antibiogram_sheet_child_rows(
                        sheet_key, sheet, approve=approve, reviewer_id=reviewer_id
                    )
                )
    return rows


def build_antibiogram_sheet_child_rows(
    sheet_key: str,
    sheet: dict[str, Any],
    *,
    approve: bool,
    reviewer_id: str | None,
) -> list[ImportRowPlan]:
    rows: list[ImportRowPlan] = []
    for risk_type, pathogen_rows in sheet.get("pathogens_by_type", {}).items():
        for pathogen_row in pathogen_rows:
            value = {"sheet_key": sheet_key, "risk_type": risk_type, **pathogen_row}
            span = source_span_for("antibiograms", value)
            rows.append(
                row_plan(
                    table="antibiogram_pathogen_rows",
                    payload={
                        "sheet_key": sheet_key,
                        "risk_type": risk_type,
                        "sno": pathogen_row.get("sno"),
                        "pathogen_name": pathogen_row["pathogen_name"],
                        "isolate_count": pathogen_row.get("n"),
                        "has_footnote_marker": pathogen_row.get("has_footnote_marker", False),
                        "prevalence_pct": pathogen_row.get("prevalence_pct"),
                        "sensitivities": pathogen_row.get("sensitivities", {}),
                        "raw_sensitivity_text": pathogen_row.get("raw_sensitivity_text"),
                    },
                    identity={
                        "sheet_key": sheet_key,
                        "risk_type": risk_type,
                        "pathogen_name": pathogen_row["pathogen_name"],
                        "sno": pathogen_row.get("sno"),
                    },
                    source_span=span,
                    approve=approve,
                    reviewer_id=reviewer_id,
                )
            )
    for criterion_name, values in sheet.get("risk_stratification", {}).items():
        value = {"sheet_key": sheet_key, "criterion_name": criterion_name, "values": values}
        span = source_span_for("antibiograms", value)
        rows.append(
            row_plan(
                table="antibiogram_risk_criteria",
                payload={
                    "sheet_key": sheet_key,
                    "criterion_name": criterion_name,
                    "type_1": values.get("1"),
                    "type_2": values.get("2"),
                    "type_3": values.get("3"),
                },
                identity={"sheet_key": sheet_key, "criterion_name": criterion_name},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    for risk_type, therapy in sheet.get("empiric_therapy", {}).items():
        value = {"sheet_key": sheet_key, "risk_type": risk_type, "empiric_therapy": therapy}
        span = source_span_for("antibiograms", value)
        rows.append(
            row_plan(
                table="antibiogram_empiric_therapy",
                payload={
                    "sheet_key": sheet_key,
                    "risk_type": risk_type,
                    "empiric_therapy": therapy,
                },
                identity={"sheet_key": sheet_key, "risk_type": risk_type},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    for risk_type, notes in sheet.get("footnotes_by_type", {}).items():
        for index, note in enumerate(notes):
            value = {"sheet_key": sheet_key, "risk_type": risk_type, "note": note, "index": index}
            span = source_span_for("antibiograms", value)
            rows.append(
                row_plan(
                    table="antibiogram_footnotes",
                    payload={"sheet_key": sheet_key, "risk_type": risk_type, "note": note},
                    identity={"sheet_key": sheet_key, "risk_type": risk_type, "note": note},
                    source_span=span,
                    approve=approve,
                    reviewer_id=reviewer_id,
                )
            )
    return rows


def build_synergy_antifungal_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    rows: list[ImportRowPlan] = []
    section = expect_object(payload["synergy_and_antifungal"], "synergy_and_antifungal")
    for row in expect_list(section.get("synergy_testing"), "synergy_and_antifungal.synergy_testing"):
        span = source_span_for("synergy_testing", row)
        rows.append(
            row_plan(
                table="synergy_testing_rows",
                payload={
                    "organism": row["Organism"],
                    "total_tested": row.get("Total No. Tested"),
                    "negative_for_synergy": row.get("Negative for Synergy"),
                    "positive_for_synergy": row.get("Positive for Synergy"),
                },
                identity={"organism": row["Organism"]},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    antifungal = expect_object(
        section.get("antifungal_susceptibility"),
        "synergy_and_antifungal.antifungal_susceptibility",
    )
    for organism_group, species_rows in antifungal.items():
        for species, drugs in expect_object(species_rows, organism_group).items():
            for drug, value in expect_object(drugs, species).items():
                row = {
                    "organism_group": organism_group,
                    "species": species,
                    "drug": drug,
                    "susceptibility_value": value,
                }
                span = source_span_for("antifungal_susceptibility", row)
                rows.append(
                    row_plan(
                        table="antifungal_susceptibility_rows",
                        payload=row,
                        identity={
                            "organism_group": organism_group,
                            "species": species,
                            "drug": drug,
                        },
                        source_span=span,
                        approve=approve,
                        reviewer_id=reviewer_id,
                    )
                )
    for index, note_text in enumerate(
        expect_list(section.get("notes"), "synergy_and_antifungal.notes")
    ):
        row = {"note_text": note_text, "sort_order": index}
        span = source_span_for("synergy_antifungal_notes", row)
        rows.append(
            row_plan(
                table="synergy_antifungal_notes",
                payload=row,
                identity={"note_text": note_text, "sort_order": index},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    return rows


def build_stewardship_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    return [
        *build_pearl_rows(
            payload["stewardship_pearls"],
            table="stewardship_pearl_rows",
            source_section="stewardship_pearls",
            approve=approve,
            reviewer_id=reviewer_id,
        ),
        *build_pearl_rows(
            payload["pearl_points"],
            table="antimicrobial_pearl_point_rows",
            source_section="pearl_points",
            approve=approve,
            reviewer_id=reviewer_id,
        ),
    ]


def build_pearl_rows(
    section_payload: dict[str, Any],
    *,
    table: str,
    source_section: str,
    approve: bool,
    reviewer_id: str | None,
) -> list[ImportRowPlan]:
    rows = []
    for section_name, pearls in expect_object(section_payload, source_section).items():
        for index, pearl_text in enumerate(expect_list(pearls, f"{source_section}.{section_name}")):
            row = {"section_name": section_name, "pearl_text": pearl_text, "sort_order": index}
            span = source_span_for(source_section, row)
            rows.append(
                row_plan(
                    table=table,
                    payload=row,
                    identity={
                        "section_name": section_name,
                        "pearl_text": pearl_text,
                        "sort_order": index,
                    },
                    source_span=span,
                    approve=approve,
                    reviewer_id=reviewer_id,
                )
            )
    return rows


def build_perioperative_rows(
    payload: dict[str, Any], *, approve: bool = False, reviewer_id: str | None = None
) -> list[ImportRowPlan]:
    rows: list[ImportRowPlan] = []
    section = expect_object(payload["perioperative"], "perioperative")
    for row in expect_list(section.get("procedure_recommendations"), "procedure_recommendations"):
        span = source_span_for("perioperative", row)
        rows.append(
            row_plan(
                table="perioperative_procedure_recommendations",
                payload={"procedure": row["Procedure"], "preferred_drug": row["Preferred Drug"]},
                identity={"procedure": row["Procedure"]},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    for row in expect_list(section.get("antibiotic_dosing"), "antibiotic_dosing"):
        span = source_span_for("perioperative", row)
        rows.append(
            row_plan(
                table="perioperative_antibiotic_dosing",
                payload={
                    "drug": row["Drug"],
                    "standard_dose": row.get("Standard Dose"),
                    "weight_based_dose": row.get("Weight-Based Dose"),
                    "bolus_or_infusion_duration": row.get(
                        "Duration for Bolus Injection (Infusion)"
                    ),
                },
                identity={"drug": row["Drug"]},
                source_span=span,
                approve=approve,
                reviewer_id=reviewer_id,
            )
        )
    for note_type in ["procedure_section_notes", "general_notes"]:
        for index, note_text in enumerate(expect_list(section.get(note_type), f"perioperative.{note_type}")):
            row = {"note_type": note_type, "note_text": note_text, "sort_order": index}
            span = source_span_for("perioperative", row)
            rows.append(
                row_plan(
                    table="perioperative_notes",
                    payload=row,
                    identity={"note_type": note_type, "note_text": note_text, "sort_order": index},
                    source_span=span,
                    approve=approve,
                    reviewer_id=reviewer_id,
                )
            )
    return rows


def build_import_rows(
    command: str,
    payload: dict[str, Any],
    *,
    approve: bool = False,
    reviewer_id: str | None = None,
) -> list[ImportRowPlan]:
    builders = {
        "import-icmr": [build_icmr_rows],
        "import-duration": [build_duration_rows],
        "import-antibiograms": [build_antibiogram_rows],
        "import-synergy-antifungal": [build_synergy_antifungal_rows],
        "import-stewardship": [build_stewardship_rows],
        "import-perioperative": [build_perioperative_rows],
        "import-all": [
            build_document_rows,
            build_icmr_rows,
            build_duration_rows,
            build_antibiogram_rows,
            build_synergy_antifungal_rows,
            build_stewardship_rows,
            build_perioperative_rows,
        ],
    }[command]
    rows: list[ImportRowPlan] = []
    for builder in builders:
        rows.extend(builder(payload, approve=approve, reviewer_id=reviewer_id))
    return rows


def database_url_from_env() -> str:
    database_url = os.environ.get("SUPABASE_DB_URL")
    if not database_url:
        raise RuntimeError("Set SUPABASE_DB_URL to the Supabase Postgres connection string.")
    return database_url


def reviewer_id_from_env(approve: bool) -> str | None:
    if not approve:
        return None
    reviewer_id = os.environ.get("CLINICAL_REVIEWER_ID")
    if not reviewer_id:
        raise RuntimeError("CLINICAL_REVIEWER_ID is required when --approve is passed.")
    return reviewer_id


def source_file_payload(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    return {
        "filename": path.name,
        "original_path": str(path),
        "file_sha256": hashlib.sha256(raw).hexdigest(),
        "mime_type": "application/json",
    }


async def import_rows_to_supabase(
    database_url: str,
    ground_truth_path: Path,
    rows: list[ImportRowPlan],
) -> ImportCounts:
    try:
        import asyncpg
    except ImportError as exc:
        raise RuntimeError("asyncpg is required for database imports.") from exc

    counts = ImportCounts()
    conn = await asyncpg.connect(database_url)
    try:
        async with conn.transaction():
            source_file_id = await get_or_insert_source_file(
                conn,
                source_file_payload(ground_truth_path),
                counts,
            )
            for row in rows:
                source_span_id = await get_or_insert_source_span(
                    conn, source_file_id, row.source_span, counts
                )
                await insert_row_if_absent(conn, row, source_span_id, counts)
    finally:
        await conn.close()
    return counts


async def get_or_insert_source_file(
    conn: Any,
    payload: dict[str, Any],
    counts: ImportCounts,
) -> str:
    existing_id = await conn.fetchval(
        "select id from public.clinical_source_files where file_sha256 = $1",
        payload["file_sha256"],
    )
    if existing_id:
        counts.source_files_skipped += 1
        return str(existing_id)

    inserted_id = await conn.fetchval(
        """
        insert into public.clinical_source_files (
          filename,
          original_path,
          file_sha256,
          mime_type
        )
        values ($1, $2, $3, $4)
        returning id
        """,
        payload["filename"],
        payload["original_path"],
        payload["file_sha256"],
        payload["mime_type"],
    )
    counts.source_files_inserted += 1
    return str(inserted_id)


async def get_or_insert_source_span(
    conn: Any,
    source_file_id: str,
    span: SourceSpanPlan,
    counts: ImportCounts,
) -> str:
    existing_id = await conn.fetchval(
        """
        select id
        from public.clinical_source_spans
        where source_file_id = $1
          and page_number is not distinct from $2
          and span_start = $3
          and span_end = $4
        """,
        source_file_id,
        span.source_page,
        span.span_start,
        span.span_end,
    )
    if existing_id:
        counts.source_spans_skipped += 1
        return str(existing_id)

    inserted_id = await conn.fetchval(
        """
        insert into public.clinical_source_spans (
          source_file_id,
          page_number,
          section_heading,
          span_start,
          span_end,
          quote
        )
        values ($1, $2, $3, $4, $5, $6)
        returning id
        """,
        source_file_id,
        span.source_page,
        span.source_section,
        span.span_start,
        span.span_end,
        span.source_quote,
    )
    counts.source_spans_inserted += 1
    return str(inserted_id)


async def insert_row_if_absent(
    conn: Any,
    row: ImportRowPlan,
    source_span_id: str,
    counts: ImportCounts,
) -> None:
    identity = {**row.identity, "source_quote": row.payload["source_quote"]}
    where_sql, values = where_clause(identity)
    existing_id = await conn.fetchval(
        f"select id from public.{row.table} where {where_sql} limit 1",
        *values,
    )
    if existing_id:
        counts.skipped(row.table)
        return

    payload = {**row.payload, "source_span_id": source_span_id}
    columns = list(payload)
    placeholders = ", ".join(f"${index}" for index in range(1, len(columns) + 1))
    await conn.execute(
        f"""
        insert into public.{row.table} ({", ".join(columns)})
        values ({placeholders})
        """,
        *(payload[column] for column in columns),
    )
    counts.inserted(row.table)


def where_clause(identity: dict[str, Any]) -> tuple[str, list[Any]]:
    clauses = []
    values = []
    for index, (column, value) in enumerate(identity.items(), start=1):
        clauses.append(f"{column} is not distinct from ${index}")
        values.append(value)
    return " and ".join(clauses), values


def dry_run_counts(rows: list[ImportRowPlan]) -> ImportCounts:
    counts = ImportCounts()
    for row in rows:
        counts.inserted(row.table)
    return counts


def print_import_summary(command: str, counts: ImportCounts, *, dry_run: bool) -> None:
    print("Ground truth import summary")
    print(f"command: {command}")
    print(f"dry_run: {dry_run}")
    print(f"source_files_inserted: {counts.source_files_inserted}")
    print(f"source_files_skipped: {counts.source_files_skipped}")
    print(f"source_spans_inserted: {counts.source_spans_inserted}")
    print(f"source_spans_skipped: {counts.source_spans_skipped}")
    tables = sorted(set(counts.rows_inserted) | set(counts.rows_skipped))
    for table in tables:
        print(
            f"  - {table}: inserted={counts.rows_inserted.get(table, 0)}, "
            f"skipped={counts.rows_skipped.get(table, 0)}"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate or import the reviewed Hinduja ground-truth JSON."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser(
        "validate",
        help="Validate the reviewed ground-truth JSON without importing data.",
    )
    validate_parser.add_argument(
        "--path",
        type=Path,
        default=GROUND_TRUTH_PATH,
        help=f"Path to reviewed JSON. Defaults to {GROUND_TRUTH_PATH}.",
    )

    for command in sorted(IMPORT_COMMANDS):
        import_parser = subparsers.add_parser(
            command,
            help=f"Import rows for {command.removeprefix('import-')} as pending_review.",
        )
        import_parser.add_argument(
            "--path",
            type=Path,
            default=GROUND_TRUTH_PATH,
            help=f"Path to reviewed JSON. Defaults to {GROUND_TRUTH_PATH}.",
        )
        import_parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Build import payloads and print counts without writing to Supabase.",
        )
        import_parser.add_argument(
            "--approve",
            action="store_true",
            help="Import rows as approved. Requires CLINICAL_REVIEWER_ID.",
        )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "validate":
        try:
            summary = validate_ground_truth_file(args.path)
        except ValueError as exc:
            print("Ground truth validation summary")
            print(f"file: {args.path}")
            print("validation: FAIL")
            print(f"error: {exc}")
            return 1

        print_validation_summary(summary)
        return 0

    try:
        payload = load_ground_truth_json(args.path)
        validate_ground_truth_payload(payload, args.path)
        reviewer_id = reviewer_id_from_env(args.approve)
        rows = build_import_rows(args.command, payload, approve=args.approve, reviewer_id=reviewer_id)
        if args.dry_run:
            counts = dry_run_counts(rows)
        else:
            counts = asyncio.run(
                import_rows_to_supabase(database_url_from_env(), args.path, rows)
            )
    except (RuntimeError, ValueError) as exc:
        print("Ground truth import summary")
        print(f"command: {args.command}")
        print("import: FAIL")
        print(f"error: {exc}")
        return 1

    print_import_summary(args.command, counts, dry_run=args.dry_run)
    print("import: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
